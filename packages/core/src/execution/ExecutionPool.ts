/**
 * ExecutionPool
 *
 * Manages concurrent agent execution using a worker pool pattern.
 * Provides queue management and enforces max concurrent executions limit.
 */

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

  constructor(options: ExecutionPoolOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 10;
  }

  /**
   * Execute a task through the pool
   *
   * If pool is at capacity, task will be queued until a slot becomes available.
   * Returns a promise that resolves when the task completes.
   *
   * @param agentId - Agent ID executing the task
   * @param execute - Function to execute
   * @returns Promise that resolves with execution result
   */
  async execute<T>(agentId: string, execute: () => Promise<T>): Promise<T> {
    // Generate unique execution ID
    const executionId = `exec-${++this.executionIdCounter}`;

    // If pool is not at capacity, execute immediately
    if (this.active.size < this.maxConcurrent) {
      return this.executeTask(executionId, agentId, execute);
    }

    // Queue the task and wait for a slot
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        executionId,
        agentId,
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        queuedAt: new Date(),
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
   */
  private processNextTask(): void {
    // If pool is at capacity or queue is empty, do nothing
    if (this.active.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Get next task from queue (FIFO)
    const task = this.queue.shift();
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
   * Get maximum concurrent executions limit
   *
   * @returns Max concurrent limit
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }
}
