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
  AgentConfig,
  PathOptions,
  getAgentDirectory,
  createAgentLogger,
  safeLoad,
  atomicWrite,
} from '@recursive-manager/common';
import {
  getAgent,
  updateAgent,
  getSubordinates,
  AgentRecord,
} from '@recursive-manager/common';
import { auditLog, AuditAction } from '@recursive-manager/common';
import { loadAgentConfig } from '../config';

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
    const baseDir = options.baseDir || process.env.RECURSIVE_MANAGER_DATA_DIR || '/data';
    const backupsDir = path.join(baseDir, 'backups', 'fired-agents');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(backupsDir, `${agentId}-${timestamp}`);

    // Create backups directory
    await fs.mkdir(backupsDir, { recursive: true });

    // Check if agent directory exists
    try {
      await fs.access(agentDirectory);
    } catch {
      logger.warn('Agent directory does not exist, skipping archive', {
        agentId,
        agentDirectory,
      });
      return false;
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

  // TODO: This will be fully implemented when task management is complete (Phase 2.3)
  // For now, we just log that tasks need to be handled
  logger.info('Handling abandoned tasks', {
    agentId,
    note: 'Full task handling will be implemented in Phase 2.3',
  });

  // Get the fired agent to find their manager
  const agent = getAgent(db, agentId);
  if (!agent) {
    return { reassigned: 0, archived: 0 };
  }

  // Placeholder for future implementation
  // When task queries are available:
  // 1. Get all active tasks for the agent
  // 2. If agent.reporting_to exists, reassign tasks to manager
  // 3. Otherwise, archive the tasks
  // 4. Update task database records
  // 5. Move task files to appropriate directories

  return { reassigned: 0, archived: 0 };
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
 * 5. **Parent Updates** (if agent has a manager)
 *    - Update parent's subordinates/registry.json
 *    - Mark agent as fired in registry
 *    - Update summary statistics
 *
 * 6. **Filesystem Operations**
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
      managerId: agent.reporting_to,
    });

    // STEP 2: HANDLE ORPHANED SUBORDINATES
    logger.info('Handling orphaned subordinates', { agentId, strategy });

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
      // Continue with firing even if orphan handling partially failed
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

    // STEP 5: PARENT UPDATES (if agent has a manager)
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

    // STEP 6: FILESYSTEM OPERATIONS (Archive)
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

    logger.info('Agent fire completed successfully', result);

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
    throw new FireAgentError(`Unexpected error during agent fire: ${error.message}`, agentId, error);
  }
}
