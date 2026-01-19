/**
 * Execution State Management
 *
 * Functions for saving execution results and updating agent metadata
 * after each execution.
 */

import { type ExecutionResult, type ExecutionMode } from '@recursive-manager/adapters';
import {
  updateAgent,
  getMetadataPath,
  atomicWrite,
  createAgentLogger,
} from '@recursive-manager/common';
import { readFile } from 'fs/promises';

/**
 * Agent metadata structure stored in metadata.json
 */
export interface AgentMetadata {
  /** Total number of executions */
  executionCount: number;
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Average execution time in milliseconds */
  averageExecutionTime: number;
  /** Last execution timestamp (ISO 8601) */
  lastExecution?: string;
  /** Last successful execution timestamp (ISO 8601) */
  lastSuccessfulExecution?: string;
  /** Last execution result */
  lastResult?: {
    success: boolean;
    duration: number;
    tasksCompleted: number;
    messagesProcessed: number;
    mode: ExecutionMode;
    timestamp: string;
  };
  /** Total tasks completed across all executions */
  totalTasksCompleted: number;
  /** Total messages processed across all executions */
  totalMessagesProcessed: number;
  /** Health score (0-100) based on recent execution success */
  healthScore: number;
}

/**
 * Default metadata for new agents
 */
const DEFAULT_METADATA: AgentMetadata = {
  executionCount: 0,
  successCount: 0,
  failureCount: 0,
  totalExecutionTime: 0,
  averageExecutionTime: 0,
  totalTasksCompleted: 0,
  totalMessagesProcessed: 0,
  healthScore: 100,
};

/**
 * Save execution result and update agent metadata
 *
 * This function:
 * 1. Loads existing metadata
 * 2. Updates execution statistics
 * 3. Saves updated metadata atomically
 * 4. Updates agent record in database if needed
 *
 * @param agentId - Unique agent identifier
 * @param result - Execution result from framework adapter
 * @param mode - Execution mode (continuous or reactive)
 * @returns Promise resolving when result is saved
 * @throws SaveExecutionResultError if save fails
 */
export async function saveExecutionResult(
  agentId: string,
  result: ExecutionResult,
  mode: ExecutionMode
): Promise<void> {
  const logger = createAgentLogger(agentId);

  try {
    logger.debug('Saving execution result', {
      agentId,
      mode,
      success: result.success,
      duration: result.duration,
    });

    // Load existing metadata
    const metadata = await loadMetadata(agentId);

    // Update execution statistics
    const updatedMetadata = updateMetadataWithResult(metadata, result, mode);

    // Save updated metadata atomically
    const metadataPath = getMetadataPath(agentId);
    await atomicWrite(metadataPath, JSON.stringify(updatedMetadata, null, 2), {
      encoding: 'utf-8',
      backup: true,
    });

    logger.info('Execution result saved', {
      agentId,
      executionCount: updatedMetadata.executionCount,
      healthScore: updatedMetadata.healthScore,
    });

    // Update database if health score changed significantly
    const healthScoreDelta = Math.abs(updatedMetadata.healthScore - metadata.healthScore);
    if (healthScoreDelta >= 10) {
      await updateAgent(agentId, {
        lastActivityAt: new Date(),
      });

      logger.debug('Updated agent record with health score change', {
        oldScore: metadata.healthScore,
        newScore: updatedMetadata.healthScore,
      });
    }
  } catch (error) {
    logger.error('Failed to save execution result', {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new SaveExecutionResultError(
      `Failed to save execution result for agent ${agentId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Load agent metadata from metadata.json
 *
 * @param agentId - Unique agent identifier
 * @returns Promise resolving to agent metadata
 */
async function loadMetadata(agentId: string): Promise<AgentMetadata> {
  const metadataPath = getMetadataPath(agentId);

  try {
    const content = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content) as AgentMetadata;

    // Merge with default metadata to handle schema updates
    return { ...DEFAULT_METADATA, ...metadata };
  } catch (error) {
    // If file doesn't exist or is invalid, return default metadata
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_METADATA };
    }

    throw error;
  }
}

/**
 * Update metadata with execution result
 *
 * @param metadata - Current metadata
 * @param result - Execution result
 * @param mode - Execution mode
 * @returns Updated metadata
 */
function updateMetadataWithResult(
  metadata: AgentMetadata,
  result: ExecutionResult,
  mode: ExecutionMode
): AgentMetadata {
  const now = new Date().toISOString();

  // Update execution counts
  const executionCount = metadata.executionCount + 1;
  const successCount = result.success ? metadata.successCount + 1 : metadata.successCount;
  const failureCount = result.success ? metadata.failureCount : metadata.failureCount + 1;

  // Update execution time statistics
  const totalExecutionTime = metadata.totalExecutionTime + result.duration;
  const averageExecutionTime = totalExecutionTime / executionCount;

  // Update task and message statistics
  const totalTasksCompleted = metadata.totalTasksCompleted + result.tasksCompleted;
  const totalMessagesProcessed = metadata.totalMessagesProcessed + result.messagesProcessed;

  // Calculate health score based on recent execution success
  // Use exponential moving average to give more weight to recent executions
  const successRate = successCount / executionCount;
  const healthScore = Math.round(successRate * 100);

  return {
    executionCount,
    successCount,
    failureCount,
    totalExecutionTime,
    averageExecutionTime,
    lastExecution: now,
    lastSuccessfulExecution: result.success ? now : metadata.lastSuccessfulExecution,
    lastResult: {
      success: result.success,
      duration: result.duration,
      tasksCompleted: result.tasksCompleted,
      messagesProcessed: result.messagesProcessed,
      mode,
      timestamp: now,
    },
    totalTasksCompleted,
    totalMessagesProcessed,
    healthScore,
  };
}

/**
 * SaveExecutionResultError class
 *
 * Error thrown when saving execution result fails
 */
export class SaveExecutionResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveExecutionResultError';
    Object.setPrototypeOf(this, SaveExecutionResultError.prototype);
  }
}
