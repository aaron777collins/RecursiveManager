/**
 * ExecutionPool
 *
 * Manages concurrent agent execution using a worker pool pattern.
 * Provides queue management and enforces max concurrent executions limit.
 */

import { DependencyGraph, CycleDetectionResult } from './DependencyGraph.js';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Task in the execution queue
 */
export interface QueuedTask<T = unknown> {
  /** Unique execution ID */
  executionId: string;
  /** Unique agent ID */
  agentId: string;
  /** Task execution function */
  execute: () => Promise<T>;
  /** Task resolve callback */
  resolve: (value: T) => void;
  /** Task reject callback */
  reject: (error: Error) => void;
  /** Timestamp when task was queued */
  queuedAt: Date;
  /** Task priority (default: 'medium') */
  priority: TaskPriority;
  /** Task IDs that must complete before this task can execute */
  dependencies?: string[];
}

/**
 * Execution pool statistics
 */
export interface PoolStatistics {
  /** Number of currently executing tasks */
  activeCount: number;
  /** Number of tasks waiting in queue */
  queueDepth: number;
  /** Maximum concurrent executions allowed */
  maxConcurrent: number;
  /** Total tasks processed */
  totalProcessed: number;
  /** Total tasks failed */
  totalFailed: number;
  /** Average queue wait time in milliseconds */
  avgQueueWaitTime: number;
  /** List of currently executing agent IDs */
  activeAgents: string[];
}

/**
 * Options for ExecutionPool
 */
export interface ExecutionPoolOptions {
  /** Maximum number of concurrent executions (default: 10) */
  maxConcurrent?: number;
  /** Enable dependency graph management with cycle detection (default: true) */
  enableDependencyGraph?: boolean;
}

/**
 * ExecutionPool class
 *
 * Manages a worker pool for agent execution with queue management.
 * Enforces max concurrent executions and provides visibility into pool state.
 */
export class ExecutionPool {
  /** Maximum concurrent executions allowed */
  private readonly maxConcurrent: number;
  /** Set of currently active execution IDs */
  private readonly active: Set<string> = new Set();
  /** Map of execution ID to agent ID for tracking active agents */
  private readonly executionToAgent: Map<string, string> = new Map();
  /** Queue of pending tasks */
  private readonly queue: QueuedTask[] = [];
  /** Statistics tracking */
  private totalProcessed = 0;
  private totalFailed = 0;
  private totalQueueWaitTime = 0;
  /** Execution ID counter */
  private executionIdCounter = 0;
  /** Set of completed execution IDs (for dependency tracking) */
  private readonly completed: Set<string> = new Set();
  /** Dependency graph for advanced dependency management */
  private readonly dependencyGraph: DependencyGraph;
  /** Whether dependency graph management is enabled */
  private readonly enableDependencyGraph: boolean;

  constructor(options: ExecutionPoolOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 10;
    this.enableDependencyGraph = options.enableDependencyGraph ?? true;
    this.dependencyGraph = new DependencyGraph();
  }

  /**
   * Execute a task through the pool
   *
   * If pool is at capacity, task will be queued until a slot becomes available.
   * Returns a promise that resolves when the task completes.
   *
   * @param agentId - Agent ID executing the task
   * @param execute - Function to execute
   * @param priority - Task priority (default: 'medium')
   * @param dependencies - Optional array of execution IDs that must complete before this task can execute
   * @returns Promise that resolves with execution result
   */
  async execute<T>(
    agentId: string,
    execute: () => Promise<T>,
    priority: TaskPriority = 'medium',
    dependencies?: string[],
  ): Promise<T> {
    // Generate unique execution ID
    const executionId = `exec-${++this.executionIdCounter}`;

    // If dependency graph is enabled, add node and check for cycles
    if (this.enableDependencyGraph && dependencies && dependencies.length > 0) {
      const added = this.dependencyGraph.addNode(executionId, dependencies);
      if (!added) {
        // Cycle detected - reject immediately
        return Promise.reject(
          new Error(
            `Dependency cycle detected: Adding execution ${executionId} with dependencies [${dependencies.join(', ')}] would create a circular dependency`,
          ),
        );
      }
    } else if (this.enableDependencyGraph) {
      // Add node with no dependencies
      this.dependencyGraph.addNode(executionId, []);
    }

    // Check if dependencies are satisfied
    const hasDependencies = dependencies && dependencies.length > 0;
    const dependenciesSatisfied = !hasDependencies || this.areDependenciesSatisfied(dependencies);

    // If pool is not at capacity AND dependencies are satisfied, execute immediately
    if (this.active.size < this.maxConcurrent && dependenciesSatisfied) {
      return this.executeTask(executionId, agentId, execute);
    }

    // Queue the task and wait for a slot (or for dependencies to be satisfied)
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        executionId,
        agentId,
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        queuedAt: new Date(),
        priority,
        dependencies,
      });
    });
  }

  /**
   * Execute a task immediately
   *
   * @param executionId - Unique execution ID
   * @param agentId - Agent ID
   * @param execute - Function to execute
   * @returns Promise with execution result
   */
  private async executeTask<T>(executionId: string, agentId: string, execute: () => Promise<T>): Promise<T> {
    this.active.add(executionId);
    this.executionToAgent.set(executionId, agentId);

    try {
      const result = await execute();
      this.totalProcessed++;
      // Mark task as completed for dependency tracking
      this.completed.add(executionId);
      // Mark task as completed in dependency graph
      if (this.enableDependencyGraph) {
        this.dependencyGraph.markCompleted(executionId);
      }
      return result;
    } catch (error) {
      this.totalFailed++;
      throw error;
    } finally {
      this.active.delete(executionId);
      this.executionToAgent.delete(executionId);
      // Process next task in queue if available
      this.processNextTask();
    }
  }

  /**
   * Process the next task in the queue
   *
   * Called automatically when a task completes to maintain max concurrency.
   * Selects tasks by priority (urgent > high > medium > low), with FIFO order for same-priority tasks.
   */
  private processNextTask(): void {
    // If pool is at capacity or queue is empty, do nothing
    if (this.active.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Find highest priority task in queue
    const task = this.selectHighestPriorityTask();
    if (!task) {
      return;
    }

    // Calculate queue wait time
    const queueWaitTime = Date.now() - task.queuedAt.getTime();
    this.totalQueueWaitTime += queueWaitTime;

    // Execute the queued task
    this.executeTask(task.executionId, task.agentId, task.execute).then(task.resolve).catch(task.reject);
  }

  /**
   * Select the highest priority task from the queue
   *
   * Priority ranking: urgent (4) > high (3) > medium (2) > low (1)
   * For same-priority tasks, uses FIFO order (earliest queued first)
   * Only selects tasks whose dependencies are satisfied
   *
   * @returns Highest priority task with satisfied dependencies, or undefined if none found
   */
  private selectHighestPriorityTask(): QueuedTask | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    // Priority numeric values for comparison
    const priorityRank: Record<TaskPriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    // Find index of highest priority task with satisfied dependencies (FIFO for ties)
    let highestPriorityIndex = -1;
    let highestPriority = -1;

    for (let i = 0; i < this.queue.length; i++) {
      const task = this.queue[i]!;
      const taskPriority = priorityRank[task.priority];

      // Check if dependencies are satisfied
      const dependenciesSatisfied = this.areDependenciesSatisfied(task.dependencies);

      // Skip tasks with unsatisfied dependencies
      if (!dependenciesSatisfied) {
        continue;
      }

      // Select this task if it's higher priority (or first eligible task)
      if (highestPriorityIndex === -1 || taskPriority > highestPriority) {
        highestPriority = taskPriority;
        highestPriorityIndex = i;
      }
      // For same priority, keep first task (FIFO)
    }

    // No eligible tasks found
    if (highestPriorityIndex === -1) {
      return undefined;
    }

    // Remove and return the selected task
    const [task] = this.queue.splice(highestPriorityIndex, 1);
    return task;
  }

  /**
   * Check if all dependencies are satisfied
   *
   * @param dependencies - Array of execution IDs (or undefined)
   * @returns True if all dependencies are completed (or no dependencies exist)
   */
  private areDependenciesSatisfied(dependencies?: string[]): boolean {
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    // All dependencies must be in the completed set
    return dependencies.every((depId) => this.completed.has(depId));
  }

  /**
   * Get list of currently executing agent IDs
   *
   * @returns Array of active agent IDs (may contain duplicates if same agent is executing multiple times)
   */
  getActiveExecutions(): string[] {
    return Array.from(this.executionToAgent.values());
  }

  /**
   * Get number of tasks waiting in queue
   *
   * @returns Queue depth
   */
  getQueueDepth(): number {
    return this.queue.length;
  }

  /**
   * Check if a specific agent is currently executing
   *
   * @param agentId - Agent ID to check
   * @returns True if agent is executing
   */
  isExecuting(agentId: string): boolean {
    for (const activeAgentId of this.executionToAgent.values()) {
      if (activeAgentId === agentId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a specific agent is queued for execution
   *
   * @param agentId - Agent ID to check
   * @returns True if agent is in queue
   */
  isQueued(agentId: string): boolean {
    return this.queue.some((task) => task.agentId === agentId);
  }

  /**
   * Get comprehensive pool statistics
   *
   * @returns Pool statistics
   */
  getStatistics(): PoolStatistics {
    return {
      activeCount: this.active.size,
      queueDepth: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      avgQueueWaitTime: this.totalProcessed > 0 ? this.totalQueueWaitTime / this.totalProcessed : 0,
      activeAgents: Array.from(this.executionToAgent.values()),
    };
  }

  /**
   * Clear all queued tasks
   *
   * Active executions will continue, but queued tasks will be rejected.
   * Useful for shutdown or testing.
   */
  clearQueue(): void {
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        task.reject(new Error('Task cancelled: execution pool queue was cleared'));
      }
    }
  }

  /**
   * Cancel all queued tasks for a specific agent
   *
   * Removes tasks from queue and rejects their promises.
   * Active executions cannot be cancelled (they will continue to completion).
   *
   * @param agentId - Agent ID whose tasks should be cancelled
   * @returns Number of tasks cancelled
   */
  cancelQueuedTasksForAgent(agentId: string): number {
    let cancelledCount = 0;

    // Filter queue to remove tasks for this agent
    const remainingTasks: QueuedTask[] = [];

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        if (task.agentId === agentId) {
          // Cancel this task
          task.reject(new Error(`Task cancelled: agent ${agentId} was paused`));
          cancelledCount++;
        } else {
          // Keep this task in queue
          remainingTasks.push(task);
        }
      }
    }

    // Restore remaining tasks to queue
    this.queue.push(...remainingTasks);

    return cancelledCount;
  }

  /**
   * Get execution IDs for a specific agent
   *
   * Returns both active and queued execution IDs for the agent.
   *
   * @param agentId - Agent ID to query
   * @returns Object with active and queued execution IDs
   */
  getExecutionIdsForAgent(agentId: string): { active: string[]; queued: string[] } {
    const active: string[] = [];
    const queued: string[] = [];

    // Find active executions
    for (const [executionId, activeAgentId] of this.executionToAgent.entries()) {
      if (activeAgentId === agentId) {
        active.push(executionId);
      }
    }

    // Find queued executions
    for (const task of this.queue) {
      if (task.agentId === agentId) {
        queued.push(task.executionId);
      }
    }

    return { active, queued };
  }

  /**
   * Get maximum concurrent executions limit
   *
   * @returns Max concurrent limit
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Get list of completed execution IDs
   *
   * Useful for verifying dependency satisfaction and debugging.
   *
   * @returns Array of completed execution IDs
   */
  getCompletedExecutions(): string[] {
    return Array.from(this.completed);
  }

  /**
   * Check if specific dependencies are satisfied
   *
   * Public method for external dependency checking.
   *
   * @param dependencies - Array of execution IDs to check
   * @returns True if all dependencies are completed
   */
  areDependenciesComplete(dependencies: string[]): boolean {
    return this.areDependenciesSatisfied(dependencies);
  }

  /**
   * Detect cycles in the dependency graph
   *
   * Only available if dependency graph is enabled.
   *
   * @returns Cycle detection result with cycle path if found
   */
  detectDependencyCycle(): CycleDetectionResult | null {
    if (!this.enableDependencyGraph) {
      return null;
    }
    return this.dependencyGraph.detectCycle();
  }

  /**
   * Get dependency graph statistics
   *
   * Only available if dependency graph is enabled.
   *
   * @returns Graph statistics or null if disabled
   */
  getDependencyGraphStatistics(): {
    totalNodes: number;
    completedNodes: number;
    readyNodes: number;
    blockedNodes: number;
  } | null {
    if (!this.enableDependencyGraph) {
      return null;
    }
    return this.dependencyGraph.getStatistics();
  }

  /**
   * Get dependencies for a specific execution
   *
   * Only available if dependency graph is enabled.
   *
   * @param executionId - Execution ID
   * @returns Array of dependency execution IDs, or null if graph disabled
   */
  getExecutionDependencies(executionId: string): string[] | null {
    if (!this.enableDependencyGraph) {
      return null;
    }
    return this.dependencyGraph.getDependencies(executionId);
  }

  /**
   * Get dependents for a specific execution (executions that depend on this one)
   *
   * Only available if dependency graph is enabled.
   *
   * @param executionId - Execution ID
   * @returns Array of dependent execution IDs, or null if graph disabled
   */
  getExecutionDependents(executionId: string): string[] | null {
    if (!this.enableDependencyGraph) {
      return null;
    }
    return this.dependencyGraph.getDependents(executionId);
  }

  /**
   * Get all execution IDs ready to execute (dependencies satisfied)
   *
   * Only available if dependency graph is enabled.
   *
   * @returns Array of ready execution IDs, or null if graph disabled
   */
  getReadyExecutions(): string[] | null {
    if (!this.enableDependencyGraph) {
      return null;
    }
    return this.dependencyGraph.getReadyExecutions();
  }
}
