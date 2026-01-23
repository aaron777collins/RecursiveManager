/**
 * Agent Firing Implementation (Task 2.2.10)
 *
 * This module implements the core fireAgent() function that orchestrates
 * the complete agent firing process including:
 * - Status validation
 * - Orphan handling with multiple strategies
 * - Task reassignment or archival (EC-2.3)
 * - Database operations (agent status, org_hierarchy)
 * - Filesystem operations (archive agent files)
 * - Parent updates (subordinates registry)
 *
 * Edge Cases Handled:
 * - EC-1.2: Orphaned agents (manager fired)
 * - EC-2.3: Abandoned tasks from paused/fired agents
 */

import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PathOptions,
  getAgentDirectory,
  createAgentLogger,
  safeLoad,
  atomicWrite,
} from '@recursivemanager/common';
import {
  getAgent,
  updateAgent,
  getSubordinates,
  AgentRecord,
  createMessage,
  MessageInput,
  getActiveTasks,
  updateTaskStatus,
  createSnapshot,
} from '@recursivemanager/common';
import { auditLog, AuditAction } from '@recursivemanager/common';
import { loadAgentConfig } from '../config';
import { generateMessageId, writeMessageToInbox, MessageData } from '../messaging/messageWriter';

/**
 * Strategy for handling orphaned subordinates when an agent is fired
 */
export type FireStrategy = 'reassign' | 'promote' | 'cascade';

/**
 * Custom error for fire operation failures
 */
export class FireAgentError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FireAgentError';
    Error.captureStackTrace(this, FireAgentError);
  }
}

/**
 * Result of firing operation
 */
export interface FireAgentResult {
  agentId: string;
  status: 'fired';
  orphansHandled: number;
  orphanStrategy: FireStrategy;
  tasksReassigned: number;
  tasksArchived: number;
  filesArchived: boolean;
}

/**
 * Update parent agent's subordinates registry to mark agent as fired
 *
 * @param managerId - ID of the parent agent
 * @param agentId - ID of the fired agent
 * @param options - Path resolution options
 */
async function updateParentSubordinatesRegistryOnFire(
  managerId: string,
  agentId: string,
  options: PathOptions = {}
): Promise<void> {
  const logger = createAgentLogger(managerId);

  try {
    // Get path to parent's subordinates registry
    const managerDirectory = getAgentDirectory(managerId, options);
    const registryPath = `${managerDirectory}/subordinates/registry.json`;

    // Load existing registry
    let registry;
    try {
      const content = await safeLoad(registryPath);
      registry = JSON.parse(content);
    } catch (err) {
      logger.warn('Parent subordinates registry not found', {
        managerId,
        agentId,
        registryPath,
      });
      return; // Registry doesn't exist, nothing to update
    }

    // Find and update the subordinate entry
    const subordinateIndex = registry.subordinates.findIndex((s: any) => s.agentId === agentId);
    if (subordinateIndex >= 0) {
      registry.subordinates[subordinateIndex].status = 'fired';
      registry.subordinates[subordinateIndex].firedAt = new Date().toISOString();

      // Update summary counts
      registry.summary.activeSubordinates = registry.subordinates.filter(
        (s: any) => s.status === 'active'
      ).length;
      registry.summary.pausedSubordinates = registry.subordinates.filter(
        (s: any) => s.status === 'paused'
      ).length;
      registry.summary.firedSubordinates = registry.subordinates.filter(
        (s: any) => s.status === 'fired'
      ).length;

      // Return hiring budget (if tracked)
      if (registry.summary.hiringBudgetRemaining !== undefined) {
        registry.summary.hiringBudgetRemaining += 1;
      }

      // Write updated registry atomically
      await atomicWrite(registryPath, JSON.stringify(registry, null, 2), {
        createDirs: true,
        encoding: 'utf8',
        mode: 0o644,
      });

      logger.info('Updated parent subordinates registry on fire', {
        managerId,
        agentId,
        activeSubordinates: registry.summary.activeSubordinates,
      });
    } else {
      logger.warn('Agent not found in parent subordinates registry', {
        managerId,
        agentId,
      });
    }
  } catch (err) {
    logger.error('Failed to update parent subordinates registry on fire', {
      managerId,
      agentId,
      error: (err as Error).message,
    });
    // Don't throw - this is a non-critical update
  }
}

/**
 * Archive agent files to backups directory
 *
 * Moves the entire agent directory to backups/{agentId}-{timestamp}/
 *
 * @param agentId - ID of the agent to archive
 * @param options - Path resolution options
 * @returns true if archival succeeded, false otherwise
 */
async function archiveAgentFiles(agentId: string, options: PathOptions = {}): Promise<boolean> {
  const logger = createAgentLogger(agentId);

  try {
    const agentDirectory = getAgentDirectory(agentId, options);
    const baseDir = options.baseDir || process.env.RECURSIVEMANAGER_DATA_DIR || '/data';
    const backupsDir = path.join(baseDir, 'backups', 'fired-agents');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(backupsDir, `${agentId}-${timestamp}`);

    // Create backups directory
    await fs.mkdir(backupsDir, { recursive: true });

    // Check if agent directory exists
    try {
      await fs.access(agentDirectory);
    } catch {
      logger.warn('Agent directory does not exist, archival is a no-op', {
        agentId,
        agentDirectory,
      });
      // Return true since there's nothing to archive (successful no-op)
      return true;
    }

    // Move directory to backups
    await fs.rename(agentDirectory, archivePath);

    logger.info('Archived agent files', {
      agentId,
      from: agentDirectory,
      to: archivePath,
    });

    return true;
  } catch (err) {
    logger.error('Failed to archive agent files', {
      agentId,
      error: (err as Error).message,
    });
    return false;
  }
}

/**
 * Handle orphaned subordinates using the specified strategy
 *
 * @param db - Database instance
 * @param agentId - ID of the fired agent
 * @param strategy - Strategy for handling orphans
 * @param options - Path resolution options
 * @returns Number of orphans handled
 */
async function handleOrphanedSubordinates(
  db: Database.Database,
  agentId: string,
  strategy: FireStrategy,
  options: PathOptions = {}
): Promise<number> {
  const logger = createAgentLogger(agentId);

  // Get all subordinates of the fired agent
  const subordinates = getSubordinates(db, agentId);

  if (subordinates.length === 0) {
    logger.debug('No subordinates to handle', { agentId });
    return 0;
  }

  logger.info('Handling orphaned subordinates', {
    agentId,
    count: subordinates.length,
    strategy,
  });

  const firedAgent = getAgent(db, agentId);
  if (!firedAgent) {
    throw new FireAgentError('Agent not found in database', agentId);
  }

  const grandparentId = firedAgent.reporting_to;

  switch (strategy) {
    case 'reassign': {
      // Reassign all subordinates to the grandparent (if exists)
      if (grandparentId) {
        for (const subordinate of subordinates) {
          // Update reporting_to in database
          // Note: This currently doesn't update org_hierarchy properly
          // That's a known limitation that will be fixed in a future task
          updateAgent(db, subordinate.id, { reportingTo: grandparentId });

          // Update config file
          try {
            const config = await loadAgentConfig(subordinate.id, options);
            config.identity.reportingTo = grandparentId;
            const configPath = path.join(getAgentDirectory(subordinate.id, options), 'config.json');
            await atomicWrite(configPath, JSON.stringify(config, null, 2), {
              createDirs: true,
              encoding: 'utf8',
              mode: 0o644,
            });
          } catch (err) {
            logger.error('Failed to update orphan config file', {
              orphanId: subordinate.id,
              error: (err as Error).message,
            });
          }

          logger.info('Reassigned orphan to grandparent', {
            orphanId: subordinate.id,
            grandparentId,
          });

          // Audit log the reassignment
          auditLog(db, {
            agentId: null,
            action: 'reassign',
            targetAgentId: subordinate.id,
            success: true,
            details: {
              reason: 'orphaned',
              previousManager: agentId,
              newManager: grandparentId,
            },
          });
        }
      } else {
        // No grandparent - set reporting_to to null (become root agents)
        for (const subordinate of subordinates) {
          updateAgent(db, subordinate.id, { reportingTo: null });

          try {
            const config = await loadAgentConfig(subordinate.id, options);
            config.identity.reportingTo = null;
            const configPath = path.join(getAgentDirectory(subordinate.id, options), 'config.json');
            await atomicWrite(configPath, JSON.stringify(config, null, 2), {
              createDirs: true,
              encoding: 'utf8',
              mode: 0o644,
            });
          } catch (err) {
            logger.error('Failed to update orphan config file', {
              orphanId: subordinate.id,
              error: (err as Error).message,
            });
          }

          logger.info('Promoted orphan to root agent', {
            orphanId: subordinate.id,
          });
        }
      }
      break;
    }

    case 'promote': {
      // Promote all subordinates to the same level as fired agent
      // (same as reassign in this implementation)
      if (grandparentId) {
        for (const subordinate of subordinates) {
          updateAgent(db, subordinate.id, { reportingTo: grandparentId });

          try {
            const config = await loadAgentConfig(subordinate.id, options);
            config.identity.reportingTo = grandparentId;
            const configPath = path.join(getAgentDirectory(subordinate.id, options), 'config.json');
            await atomicWrite(configPath, JSON.stringify(config, null, 2), {
              createDirs: true,
              encoding: 'utf8',
              mode: 0o644,
            });
          } catch (err) {
            logger.error('Failed to update orphan config file', {
              orphanId: subordinate.id,
              error: (err as Error).message,
            });
          }

          logger.info('Promoted orphan to grandparent level', {
            orphanId: subordinate.id,
            grandparentId,
          });

          auditLog(db, {
            agentId: null,
            action: 'promote',
            targetAgentId: subordinate.id,
            success: true,
            details: {
              reason: 'orphaned',
              previousManager: agentId,
              newManager: grandparentId,
            },
          });
        }
      } else {
        // No grandparent - become root agents
        for (const subordinate of subordinates) {
          updateAgent(db, subordinate.id, { reportingTo: null });

          try {
            const config = await loadAgentConfig(subordinate.id, options);
            config.identity.reportingTo = null;
            const configPath = path.join(getAgentDirectory(subordinate.id, options), 'config.json');
            await atomicWrite(configPath, JSON.stringify(config, null, 2), {
              createDirs: true,
              encoding: 'utf8',
              mode: 0o644,
            });
          } catch (err) {
            logger.error('Failed to update orphan config file', {
              orphanId: subordinate.id,
              error: (err as Error).message,
            });
          }

          logger.info('Promoted orphan to root agent', {
            orphanId: subordinate.id,
          });
        }
      }
      break;
    }

    case 'cascade': {
      // Fire all subordinates recursively (cascade deletion)
      for (const subordinate of subordinates) {
        try {
          // Recursively fire the subordinate (will handle their subordinates too)
          await fireAgent(db, subordinate.id, 'cascade', options);
          logger.info('Cascade fired subordinate', {
            orphanId: subordinate.id,
          });
        } catch (err) {
          logger.error('Failed to cascade fire subordinate', {
            orphanId: subordinate.id,
            error: (err as Error).message,
          });
          // Continue with other subordinates even if one fails
        }
      }
      break;
    }

    default:
      throw new FireAgentError(`Unknown fire strategy: ${strategy}`, agentId);
  }

  return subordinates.length;
}

/**
 * Handle abandoned tasks from the fired agent
 *
 * Tasks can be:
 * - Reassigned to the manager (if exists)
 * - Archived if no manager exists
 *
 * @param db - Database instance
 * @param agentId - ID of the fired agent
 * @returns Object with counts of reassigned and archived tasks
 */
async function handleAbandonedTasks(
  db: Database.Database,
  agentId: string
): Promise<{ reassigned: number; archived: number }> {
  const logger = createAgentLogger(agentId);

  logger.info('Handling abandoned tasks for fired agent', { agentId });

  // Get the fired agent to find their manager
  const agent = getAgent(db, agentId);
  if (!agent) {
    logger.warn('Cannot handle abandoned tasks: agent not found', { agentId });
    return { reassigned: 0, archived: 0 };
  }

  // Get all active tasks (pending, in-progress, blocked) for this agent
  const activeTasks = getActiveTasks(db, agentId);

  if (activeTasks.length === 0) {
    logger.info('No active tasks to handle', { agentId });
    return { reassigned: 0, archived: 0 };
  }

  logger.info('Found active tasks to handle', {
    agentId,
    taskCount: activeTasks.length,
  });

  let reassigned = 0;
  let archived = 0;

  // Strategy: If agent has a manager, reassign tasks to manager
  // Otherwise, archive the tasks
  if (agent.reporting_to) {
    logger.info('Reassigning tasks to manager', {
      agentId,
      managerId: agent.reporting_to,
      taskCount: activeTasks.length,
    });

    // Reassign each task to the manager
    for (const task of activeTasks) {
      try {
        // Use delegateTask to properly reassign with all validations
        // Note: delegateTask validates that target is a subordinate,
        // but manager is actually the *parent*, so we need to update directly
        // Actually, we'll update the task's agent_id and delegated_to fields

        // For now, we'll update the task status to indicate it needs reassignment
        // The manager will see these tasks in their task list
        updateTaskStatus(
          db,
          task.id,
          'pending', // Reset to pending for manager to pick up
          task.version
        );

        // Update the task's agent assignment
        db.prepare(
          `UPDATE tasks
           SET agent_id = ?,
               delegated_to = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(agent.reporting_to, task.id);

        // Audit log the reassignment
        auditLog(db, {
          action: AuditAction.TASK_DELEGATE,
          agentId: agent.reporting_to,
          targetAgentId: agentId,
          success: true,
          details: {
            taskId: task.id,
            reason: 'Agent fired - tasks reassigned to manager',
            from: agentId,
            to: agent.reporting_to,
          },
        });

        reassigned++;
        logger.debug('Task reassigned to manager', {
          taskId: task.id,
          from: agentId,
          to: agent.reporting_to,
        });
      } catch (error) {
        logger.error('Failed to reassign task', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other tasks even if one fails
      }
    }
  } else {
    logger.info('Archiving tasks (no manager to reassign to)', {
      agentId,
      taskCount: activeTasks.length,
    });

    // Archive tasks if agent has no manager
    for (const task of activeTasks) {
      try {
        // Update task status to archived
        updateTaskStatus(db, task.id, 'archived', task.version);

        // Audit log the archival
        auditLog(db, {
          action: AuditAction.TASK_UPDATE,
          agentId,
          success: true,
          details: {
            taskId: task.id,
            reason: 'Agent fired without manager',
            status: 'archived',
          },
        });

        archived++;
        logger.debug('Task archived', {
          taskId: task.id,
          agentId,
        });
      } catch (error) {
        logger.error('Failed to archive task', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other tasks even if one fails
      }
    }
  }

  logger.info('Completed handling abandoned tasks', {
    agentId,
    reassigned,
    archived,
    total: activeTasks.length,
  });

  return { reassigned, archived };
}

/**
 * Send notifications to affected agents after firing operation
 *
 * Notifies:
 * 1. The fired agent (high priority, action required)
 * 2. The manager (if exists) about subordinate termination
 * 3. All subordinates about their status change
 *
 * @param db - Database instance
 * @param firedAgent - The agent being fired
 * @param subordinates - List of subordinates affected
 * @param strategy - Strategy used for orphan handling
 * @param result - Fire operation result details
 * @param options - Path resolution options
 */
async function notifyAffectedAgents(
  db: Database.Database,
  firedAgent: AgentRecord,
  subordinates: AgentRecord[],
  strategy: FireStrategy,
  result: { orphansHandled: number; tasksReassigned: number; tasksArchived: number },
  options: PathOptions = {}
): Promise<void> {
  const logger = createAgentLogger('system');
  const timestamp = new Date().toISOString();

  logger.info('Sending notifications to affected agents', {
    firedAgentId: firedAgent.id,
    strategy,
    subordinatesCount: subordinates.length,
  });

  const notifications: Array<{ agentId: string; message: MessageData; dbMessage: MessageInput }> =
    [];

  // 1. Notification to the fired agent
  const firedAgentMessageId = generateMessageId();
  const firedAgentFilePath = `inbox/unread/${firedAgentMessageId}.md`;

  notifications.push({
    agentId: firedAgent.id,
    message: {
      id: firedAgentMessageId,
      from: 'system',
      to: firedAgent.id,
      timestamp,
      priority: 'high',
      channel: 'internal',
      read: false,
      actionRequired: true,
      subject: `Termination Notice: You have been fired`,
      content: `# Termination Notice

You have been terminated from your position as **${firedAgent.role}**.

## Details

- **Effective Date**: ${timestamp}
- **Subordinates**: ${subordinates.length > 0 ? `${subordinates.length} subordinate(s) affected` : 'No subordinates'}
- **Strategy Applied**: ${strategy}
- **Tasks Handled**: ${result.tasksReassigned} reassigned, ${result.tasksArchived} archived

## What Happens Next

${subordinates.length > 0 ? `Your subordinates have been ${strategy === 'cascade' ? 'cascade-fired' : strategy === 'reassign' ? 'reassigned to your manager' : 'promoted under your manager'}.` : 'You had no subordinates.'}

Your agent directory has been archived to the backups folder for future reference.

## Action Required

Please ensure all outstanding work is documented and accessible to your manager${firedAgent.reporting_to ? ` (${firedAgent.reporting_to})` : ''}.

---
*This is an automated system notification.*`,
    },
    dbMessage: {
      id: firedAgentMessageId,
      from_agent_id: 'system',
      to_agent_id: firedAgent.id,
      timestamp,
      priority: 'high',
      channel: 'internal',
      read: false,
      action_required: true,
      subject: `Termination Notice: You have been fired`,
      message_path: firedAgentFilePath,
    },
  });

  // 2. Notification to the manager (if exists)
  if (firedAgent.reporting_to) {
    const managerMessageId = generateMessageId();
    const managerFilePath = `inbox/unread/${managerMessageId}.md`;

    notifications.push({
      agentId: firedAgent.reporting_to,
      message: {
        id: managerMessageId,
        from: 'system',
        to: firedAgent.reporting_to,
        timestamp,
        priority: 'high',
        channel: 'internal',
        read: false,
        actionRequired: false,
        subject: `Subordinate Termination: ${firedAgent.role} (${firedAgent.id})`,
        content: `# Subordinate Termination Notification

Your subordinate **${firedAgent.display_name}** (${firedAgent.role}) has been terminated.

## Details

- **Agent ID**: ${firedAgent.id}
- **Role**: ${firedAgent.role}
- **Termination Date**: ${timestamp}
- **Orphan Strategy**: ${strategy}
- **Subordinates Affected**: ${subordinates.length}

## Impact

${
  subordinates.length > 0
    ? `
### Subordinates Handled

The fired agent had ${subordinates.length} direct report(s). The following action was taken:

${strategy === 'reassign' ? `- All subordinates have been **reassigned** to you` : strategy === 'promote' ? `- All subordinates have been **promoted** to report to you` : `- All subordinates have been **cascade-fired**`}
`
    : '- No subordinates were affected (agent had no direct reports)'
}

### Tasks

- **Tasks Reassigned**: ${result.tasksReassigned}
- **Tasks Archived**: ${result.tasksArchived}

## Next Steps

${subordinates.length > 0 && strategy !== 'cascade' ? `You now have ${subordinates.length} additional direct report(s). Please review their work and provide guidance as needed.` : 'No action required from you at this time.'}

---
*This is an automated system notification.*`,
      },
      dbMessage: {
        id: managerMessageId,
        from_agent_id: 'system',
        to_agent_id: firedAgent.reporting_to,
        timestamp,
        priority: 'high',
        channel: 'internal',
        read: false,
        action_required: false,
        subject: `Subordinate Termination: ${firedAgent.role} (${firedAgent.id})`,
        message_path: managerFilePath,
      },
    });
  }

  // 3. Notifications to subordinates
  for (const subordinate of subordinates) {
    const subordinateMessageId = generateMessageId();
    const subordinateFilePath = `inbox/unread/${subordinateMessageId}.md`;

    if (strategy === 'cascade') {
      // Notify about cascade firing
      notifications.push({
        agentId: subordinate.id,
        message: {
          id: subordinateMessageId,
          from: 'system',
          to: subordinate.id,
          timestamp,
          priority: 'urgent',
          channel: 'internal',
          read: false,
          actionRequired: true,
          subject: `Cascade Termination: You have been fired`,
          content: `# Cascade Termination Notice

You have been terminated as part of a cascade firing operation.

## Details

- **Effective Date**: ${timestamp}
- **Reason**: Your manager **${firedAgent.display_name}** (${firedAgent.role}) was fired, triggering a cascade termination
- **Your Role**: ${subordinate.role}

## What This Means

When an agent is fired with the "cascade" strategy, all subordinates in the reporting chain are also terminated. This ensures clean organizational structure.

## Action Required

Please ensure all outstanding work is documented. Your agent directory will be archived to the backups folder.

---
*This is an automated system notification.*`,
        },
        dbMessage: {
          id: subordinateMessageId,
          from_agent_id: 'system',
          to_agent_id: subordinate.id,
          timestamp,
          priority: 'urgent',
          channel: 'internal',
          read: false,
          action_required: true,
          subject: `Cascade Termination: You have been fired`,
          message_path: subordinateFilePath,
        },
      });
    } else {
      // Notify about manager change (reassign or promote)
      const newManagerId = firedAgent.reporting_to || 'none';
      notifications.push({
        agentId: subordinate.id,
        message: {
          id: subordinateMessageId,
          from: 'system',
          to: subordinate.id,
          timestamp,
          priority: 'high',
          channel: 'internal',
          read: false,
          actionRequired: true,
          subject: `Manager Change: New reporting structure`,
          content: `# Manager Change Notification

Your reporting structure has changed due to your manager being terminated.

## Details

- **Former Manager**: ${firedAgent.display_name} (${firedAgent.role}, ${firedAgent.id})
- **Termination Date**: ${timestamp}
- **New Manager**: ${newManagerId}
- **Strategy**: ${strategy}

## What This Means

${strategy === 'reassign' ? `You have been **reassigned** to your former manager's supervisor. Your new reporting relationship is now with agent \`${newManagerId}\`.` : `You have been **promoted** in the hierarchy. You now report directly to agent \`${newManagerId}\`.`}

## Action Required

- Update any ongoing work to reflect the new reporting structure
- Reach out to your new manager for guidance on priorities
- Continue your assigned tasks without interruption

Your role and responsibilities remain unchanged.

---
*This is an automated system notification.*`,
        },
        dbMessage: {
          id: subordinateMessageId,
          from_agent_id: 'system',
          to_agent_id: subordinate.id,
          timestamp,
          priority: 'high',
          channel: 'internal',
          read: false,
          action_required: true,
          subject: `Manager Change: New reporting structure`,
          message_path: subordinateFilePath,
        },
      });
    }
  }

  // Send all notifications in batch
  let successCount = 0;
  let errorCount = 0;

  for (const { agentId, message, dbMessage } of notifications) {
    try {
      // Write to database
      createMessage(db, dbMessage);

      // Write to filesystem (map baseDir to dataDir for message writer options)
      await writeMessageToInbox(agentId, message, { dataDir: options.baseDir });

      successCount++;
      logger.debug('Notification sent successfully', {
        messageId: message.id,
        toAgent: agentId,
      });
    } catch (err) {
      errorCount++;
      logger.error('Failed to send notification', {
        messageId: message.id,
        toAgent: agentId,
        error: (err as Error).message,
      });
      // Continue with other notifications even if one fails
    }
  }

  logger.info('Notification phase completed', {
    total: notifications.length,
    success: successCount,
    errors: errorCount,
  });
}

/**
 * Fire an agent from the organization
 *
 * This is the main orchestration function that handles the complete agent firing process.
 * It performs the following steps in order:
 *
 * 1. **Validation**
 *    - Verify agent exists and is not already fired
 *    - Get agent details and configuration
 *
 * 2. **Handle Orphans** (if agent has subordinates)
 *    - Apply the specified strategy (reassign, promote, cascade)
 *    - Update subordinates' reporting_to relationships
 *    - Update subordinates' config files
 *
 * 3. **Handle Abandoned Tasks**
 *    - Reassign active tasks to manager (if exists)
 *    - Archive tasks if no manager exists
 *    - Update task database records
 *
 * 4. **Database Operations**
 *    - Update agent status to 'fired'
 *    - Audit log the FIRE action
 *
 * 5. **Notify Affected Agents**
 *    - Send notification to the fired agent
 *    - Send notification to the manager (if exists)
 *    - Send notifications to all subordinates based on strategy
 *    - Write messages to database and filesystem
 *
 * 6. **Parent Updates** (if agent has a manager)
 *    - Update parent's subordinates/registry.json
 *    - Mark agent as fired in registry
 *    - Update summary statistics
 *
 * 7. **Filesystem Operations**
 *    - Archive agent directory to backups/fired-agents/
 *    - Preserve all agent data for future reference
 *
 * Error Handling:
 * - Validation errors: Throws FireAgentError
 * - Orphan handling errors: Logs and continues (partial success)
 * - Task handling errors: Logs and continues (partial success)
 * - Database errors: Throws FireAgentError
 * - Parent update errors: Logs but doesn't throw (non-critical)
 * - Archive errors: Logs but doesn't throw (non-critical)
 *
 * @param db - Database instance
 * @param agentId - ID of the agent to fire
 * @param strategy - Strategy for handling orphaned subordinates (default: 'reassign')
 * @param options - Path resolution options
 * @returns Result object with operation details
 * @throws {FireAgentError} If firing operation fails
 *
 * @example
 * ```typescript
 * // Fire an agent and reassign subordinates to their grandparent
 * const result = await fireAgent(db, 'dev-001', 'reassign');
 * console.log(`Fired agent, handled ${result.orphansHandled} orphans`);
 *
 * // Fire an agent and cascade to all subordinates
 * const result = await fireAgent(db, 'manager-001', 'cascade');
 * console.log(`Cascade fired agent and all subordinates`);
 * ```
 */
export async function fireAgent(
  db: Database.Database,
  agentId: string,
  strategy: FireStrategy = 'reassign',
  options: PathOptions = {}
): Promise<FireAgentResult> {
  const logger = createAgentLogger(agentId);

  logger.info('Starting agent fire process', {
    agentId,
    strategy,
  });

  try {
    // STEP 1: VALIDATION
    logger.debug('Validating agent status', { agentId });

    // Validate fire strategy
    const validStrategies: FireStrategy[] = ['reassign', 'promote', 'cascade'];
    if (!validStrategies.includes(strategy)) {
      throw new FireAgentError(`Unknown fire strategy: ${strategy}`, agentId);
    }

    const agent = getAgent(db, agentId);
    if (!agent) {
      throw new FireAgentError('Agent not found in database', agentId);
    }

    if (agent.status === 'fired') {
      throw new FireAgentError('Agent is already fired', agentId);
    }

    logger.debug('Agent validated for firing', {
      agentId,
      currentStatus: agent.status,
      managerId: agent.reporting_to ?? undefined,
    });

    // STEP 2: HANDLE ORPHANED SUBORDINATES
    logger.info('Handling orphaned subordinates', { agentId, strategy });

    // Get subordinates before handling them (needed for notifications later)
    const subordinates = getSubordinates(db, agentId);
    logger.debug('Retrieved subordinates for notification', {
      agentId,
      count: subordinates.length,
    });

    let orphansHandled = 0;
    try {
      orphansHandled = await handleOrphanedSubordinates(db, agentId, strategy, options);
      logger.info('Orphaned subordinates handled', {
        agentId,
        count: orphansHandled,
      });
    } catch (err) {
      logger.error('Failed to handle orphaned subordinates', {
        agentId,
        error: (err as Error).message,
      });
      // CRITICAL: Do not continue if orphan handling fails - this would leave the org hierarchy in a corrupt state
      throw new FireAgentError(
        `Failed to handle orphaned subordinates during fire operation: ${(err as Error).message}`,
        agentId,
        'ORPHAN_HANDLING_FAILED'
      );
    }

    // STEP 3: HANDLE ABANDONED TASKS
    logger.info('Handling abandoned tasks', { agentId });

    let taskResult = { reassigned: 0, archived: 0 };
    try {
      taskResult = await handleAbandonedTasks(db, agentId);
      logger.info('Abandoned tasks handled', {
        agentId,
        reassigned: taskResult.reassigned,
        archived: taskResult.archived,
      });
    } catch (err) {
      logger.error('Failed to handle abandoned tasks', {
        agentId,
        error: (err as Error).message,
      });
      // Continue with firing even if task handling failed
    }

    // STEP 4: DATABASE OPERATIONS
    logger.info('Updating agent status to fired', { agentId });

    try {
      const updated = updateAgent(db, agentId, { status: 'fired' });
      if (!updated) {
        throw new FireAgentError('Failed to update agent status', agentId);
      }

      logger.info('Agent status updated to fired', {
        agentId,
        status: updated.status,
      });

      // Audit log the fire action
      auditLog(db, {
        agentId: agent.reporting_to,
        action: AuditAction.FIRE,
        targetAgentId: agentId,
        success: true,
        details: {
          role: agent.role,
          displayName: agent.display_name,
          strategy,
          orphansHandled,
          tasksReassigned: taskResult.reassigned,
          tasksArchived: taskResult.archived,
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to update agent status', {
        agentId,
        error: error.message,
      });

      // Audit log failed fire
      auditLog(db, {
        agentId: agent.reporting_to,
        action: AuditAction.FIRE,
        targetAgentId: agentId,
        success: false,
        details: {
          error: error.message,
        },
      });

      throw new FireAgentError(`Failed to update agent status: ${error.message}`, agentId, error);
    }

    // STEP 5: NOTIFY AFFECTED AGENTS
    logger.info('Notifying affected agents', { agentId });

    try {
      await notifyAffectedAgents(
        db,
        agent,
        subordinates,
        strategy,
        {
          orphansHandled,
          tasksReassigned: taskResult.reassigned,
          tasksArchived: taskResult.archived,
        },
        options
      );
      logger.info('Affected agents notified', { agentId });
    } catch (err) {
      logger.error('Failed to notify affected agents', {
        agentId,
        error: (err as Error).message,
      });
      // Don't throw - notification failure is non-critical
    }

    // STEP 6: PARENT UPDATES (if agent has a manager)
    if (agent.reporting_to) {
      logger.info('Updating parent subordinates registry', {
        agentId,
        managerId: agent.reporting_to,
      });

      try {
        await updateParentSubordinatesRegistryOnFire(agent.reporting_to, agentId, options);
        logger.info('Parent subordinates registry updated', {
          agentId,
          managerId: agent.reporting_to,
        });
      } catch (err) {
        logger.error('Failed to update parent subordinates registry', {
          agentId,
          managerId: agent.reporting_to,
          error: (err as Error).message,
        });
        // Don't throw - this is a non-critical update
      }
    }

    // STEP 7: FILESYSTEM OPERATIONS (Archive)
    logger.info('Archiving agent files', { agentId });

    let filesArchived = false;
    try {
      filesArchived = await archiveAgentFiles(agentId, options);
      if (filesArchived) {
        logger.info('Agent files archived successfully', { agentId });
      } else {
        logger.warn('Agent files not archived (may not exist)', { agentId });
      }
    } catch (err) {
      logger.error('Failed to archive agent files', {
        agentId,
        error: (err as Error).message,
      });
      // Don't throw - archival failure is non-critical
    }

    // STEP 8: CREATE SNAPSHOT (for rollback capability)
    try {
      const baseDir = options.baseDir || path.join(require('os').homedir(), '.recursivemanager');
      const snapshotsDir = path.join(baseDir, 'snapshots');

      logger.info('Creating database snapshot after firing agent', {
        agentId,
        strategy,
      });

      await createSnapshot(db, snapshotsDir, {
        reason: `Agent fired: ${agentId} (strategy: ${strategy})`,
        agentId,
      });

      logger.info('Database snapshot created successfully', {
        agentId,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to create database snapshot', {
        agentId,
        error: error.message,
      });
      // Note: We don't throw here because snapshot creation is non-critical
      // The agent was successfully fired; snapshot failure shouldn't fail the operation
      logger.warn('Agent fired successfully but snapshot creation failed', {
        agentId,
        message: 'Snapshot creation failed but agent is fired',
      });
    }

    // SUCCESS
    const result: FireAgentResult = {
      agentId,
      status: 'fired',
      orphansHandled,
      orphanStrategy: strategy,
      tasksReassigned: taskResult.reassigned,
      tasksArchived: taskResult.archived,
      filesArchived,
    };

    logger.info('Agent fire completed successfully', { result });

    return result;
  } catch (err) {
    // If it's already a FireAgentError, re-throw as-is
    if (err instanceof FireAgentError) {
      throw err;
    }

    // Wrap unexpected errors
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Unexpected error during agent fire', {
      agentId,
      error: error.message,
    });
    throw new FireAgentError(
      `Unexpected error during agent fire: ${error.message}`,
      agentId,
      error
    );
  }
}
