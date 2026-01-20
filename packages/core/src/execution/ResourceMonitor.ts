/**
 * ResourceMonitor
 *
 * Monitors and enforces resource quotas (CPU, memory) for agent executions.
 * Tracks resource usage at the process level using Node.js built-in APIs.
 */

import * as os from 'os';
import * as v8 from 'v8';

/**
 * Resource usage snapshot
 */
export interface ResourceUsage {
  /** Memory usage in bytes */
  memoryBytes: number;
  /** Memory usage in MB */
  memoryMB: number;
  /** CPU usage percentage (0-100) */
  cpuPercent: number;
  /** Timestamp of measurement */
  timestamp: Date;
}

/**
 * Resource quota configuration
 */
export interface ResourceQuota {
  /** Maximum memory in MB (0 = unlimited) */
  maxMemoryMB?: number;
  /** Maximum CPU percentage (0-100, 0 = unlimited) */
  maxCpuPercent?: number;
  /** Maximum execution time in minutes (0 = unlimited) */
  maxExecutionMinutes?: number;
}

/**
 * Resource monitoring result
 */
export interface ResourceMonitorResult {
  /** Current resource usage */
  usage: ResourceUsage;
  /** Configured quota */
  quota: ResourceQuota;
  /** Whether memory quota is exceeded */
  memoryExceeded: boolean;
  /** Whether CPU quota is exceeded */
  cpuExceeded: boolean;
  /** Whether execution time quota is exceeded */
  timeExceeded: boolean;
  /** Whether any quota is exceeded */
  quotaExceeded: boolean;
  /** Human-readable violation message (if quota exceeded) */
  violationMessage?: string;
}

/**
 * ResourceMonitor class
 *
 * Provides resource monitoring and quota enforcement capabilities.
 * Uses Node.js process metrics for CPU and memory tracking.
 */
export class ResourceMonitor {
  /** Map of execution ID to start time */
  private readonly executionStartTimes: Map<string, Date> = new Map();

  /** Map of execution ID to last CPU measurement */
  private readonly lastCpuUsage: Map<string, { user: number; system: number; timestamp: number }> = new Map();

  /**
   * Start monitoring an execution
   *
   * @param executionId - Unique execution ID
   */
  startMonitoring(executionId: string): void {
    this.executionStartTimes.set(executionId, new Date());

    // Initialize CPU measurement
    const cpuUsage = process.cpuUsage();
    this.lastCpuUsage.set(executionId, {
      user: cpuUsage.user,
      system: cpuUsage.system,
      timestamp: Date.now(),
    });
  }

  /**
   * Stop monitoring an execution
   *
   * @param executionId - Unique execution ID
   */
  stopMonitoring(executionId: string): void {
    this.executionStartTimes.delete(executionId);
    this.lastCpuUsage.delete(executionId);
  }

  /**
   * Get current resource usage
   *
   * @returns Current resource usage snapshot
   */
  getCurrentUsage(): ResourceUsage {
    const memoryUsage = process.memoryUsage();
    const heapUsedBytes = memoryUsage.heapUsed;
    const heapUsedMB = heapUsedBytes / (1024 * 1024);

    // Calculate CPU usage percentage
    const cpuPercent = this.calculateCpuPercent();

    return {
      memoryBytes: heapUsedBytes,
      memoryMB: heapUsedMB,
      cpuPercent,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate CPU usage percentage
   *
   * Uses process.cpuUsage() to calculate CPU time as percentage of wall time.
   *
   * @returns CPU usage percentage (0-100)
   */
  private calculateCpuPercent(): number {
    const cpuUsage = process.cpuUsage();
    const totalCpuTime = cpuUsage.user + cpuUsage.system; // in microseconds

    // Get system uptime in microseconds
    const uptimeMs = os.uptime() * 1000;
    const uptimeMicroseconds = uptimeMs * 1000;

    // CPU percent = (cpu time / wall time) * 100 * number of CPUs
    // We normalize by number of CPUs so 100% means "fully using 1 CPU"
    const numCpus = os.cpus().length;
    const cpuPercent = (totalCpuTime / uptimeMicroseconds) * 100 * numCpus;

    return Math.min(100, Math.max(0, cpuPercent));
  }

  /**
   * Check if resource quotas are exceeded
   *
   * @param executionId - Execution ID to check
   * @param quota - Resource quota to enforce
   * @returns Monitoring result with quota violation details
   */
  checkQuota(executionId: string, quota: ResourceQuota): ResourceMonitorResult {
    const usage = this.getCurrentUsage();

    // Check memory quota
    const memoryExceeded = quota.maxMemoryMB !== undefined &&
                          quota.maxMemoryMB > 0 &&
                          usage.memoryMB > quota.maxMemoryMB;

    // Check CPU quota
    const cpuExceeded = quota.maxCpuPercent !== undefined &&
                       quota.maxCpuPercent > 0 &&
                       usage.cpuPercent > quota.maxCpuPercent;

    // Check execution time quota
    let timeExceeded = false;
    const startTime = this.executionStartTimes.get(executionId);
    if (startTime && quota.maxExecutionMinutes !== undefined && quota.maxExecutionMinutes > 0) {
      const elapsedMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
      timeExceeded = elapsedMinutes > quota.maxExecutionMinutes;
    }

    const quotaExceeded = memoryExceeded || cpuExceeded || timeExceeded;

    // Build violation message
    let violationMessage: string | undefined;
    if (quotaExceeded) {
      const violations: string[] = [];
      if (memoryExceeded) {
        violations.push(`Memory: ${usage.memoryMB.toFixed(2)} MB > ${quota.maxMemoryMB} MB`);
      }
      if (cpuExceeded) {
        violations.push(`CPU: ${usage.cpuPercent.toFixed(2)}% > ${quota.maxCpuPercent}%`);
      }
      if (timeExceeded && startTime) {
        const elapsedMinutes = ((Date.now() - startTime.getTime()) / (1000 * 60)).toFixed(2);
        violations.push(`Time: ${elapsedMinutes} min > ${quota.maxExecutionMinutes} min`);
      }
      violationMessage = `Resource quota exceeded: ${violations.join(', ')}`;
    }

    return {
      usage,
      quota,
      memoryExceeded,
      cpuExceeded,
      timeExceeded,
      quotaExceeded,
      violationMessage,
    };
  }

  /**
   * Get execution runtime in minutes
   *
   * @param executionId - Execution ID
   * @returns Runtime in minutes, or 0 if execution not found
   */
  getExecutionRuntime(executionId: string): number {
    const startTime = this.executionStartTimes.get(executionId);
    if (!startTime) {
      return 0;
    }
    return (Date.now() - startTime.getTime()) / (1000 * 60);
  }

  /**
   * Get memory statistics
   *
   * @returns Detailed memory statistics
   */
  getMemoryStats(): {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    rssMB: number;
    heapLimit: number;
    heapAvailable: number;
  } {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    return {
      heapUsedMB: memUsage.heapUsed / (1024 * 1024),
      heapTotalMB: memUsage.heapTotal / (1024 * 1024),
      externalMB: memUsage.external / (1024 * 1024),
      rssMB: memUsage.rss / (1024 * 1024),
      heapLimit: heapStats.heap_size_limit / (1024 * 1024),
      heapAvailable: (heapStats.heap_size_limit - memUsage.heapUsed) / (1024 * 1024),
    };
  }

  /**
   * Clear all monitoring data
   *
   * Useful for testing or cleanup.
   */
  clear(): void {
    this.executionStartTimes.clear();
    this.lastCpuUsage.clear();
  }
}
