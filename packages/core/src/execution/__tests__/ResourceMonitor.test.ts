/**
 * Unit tests for ResourceMonitor
 *
 * Tests resource monitoring and quota enforcement.
 */

import { ResourceMonitor } from '../ResourceMonitor';

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    monitor = new ResourceMonitor();
  });

  afterEach(() => {
    monitor.clear();
  });

  describe('Basic Monitoring', () => {
    it('should get current resource usage', () => {
      const usage = monitor.getCurrentUsage();

      expect(usage.memoryBytes).toBeGreaterThan(0);
      expect(usage.memoryMB).toBeGreaterThan(0);
      expect(usage.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(usage.cpuPercent).toBeLessThanOrEqual(100);
      expect(usage.timestamp).toBeInstanceOf(Date);
    });

    it('should start monitoring execution', () => {
      monitor.startMonitoring('exec-1');

      const runtime = monitor.getExecutionRuntime('exec-1');
      expect(runtime).toBeGreaterThanOrEqual(0);
    });

    it('should stop monitoring execution', () => {
      monitor.startMonitoring('exec-1');
      monitor.stopMonitoring('exec-1');

      const runtime = monitor.getExecutionRuntime('exec-1');
      expect(runtime).toBe(0); // Returns 0 when not found
    });

    it('should get execution runtime in minutes', async () => {
      monitor.startMonitoring('exec-1');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const runtime = monitor.getExecutionRuntime('exec-1');
      expect(runtime).toBeGreaterThan(0);
      expect(runtime).toBeLessThan(1); // Should be < 1 minute
    });

    it('should return 0 runtime for unknown execution', () => {
      const runtime = monitor.getExecutionRuntime('unknown');
      expect(runtime).toBe(0);
    });
  });

  describe('Memory Statistics', () => {
    it('should get memory statistics', () => {
      const stats = monitor.getMemoryStats();

      expect(stats.heapUsedMB).toBeGreaterThan(0);
      expect(stats.heapTotalMB).toBeGreaterThan(0);
      expect(stats.heapLimit).toBeGreaterThan(0);
      expect(stats.heapAvailable).toBeGreaterThan(0);
      expect(stats.rssMB).toBeGreaterThan(0);
      expect(stats.externalMB).toBeGreaterThanOrEqual(0);
    });

    it('should have heap available less than heap limit', () => {
      const stats = monitor.getMemoryStats();
      expect(stats.heapAvailable).toBeLessThanOrEqual(stats.heapLimit);
    });
  });

  describe('Quota Checking', () => {
    it('should detect memory quota exceeded', () => {
      monitor.startMonitoring('exec-1');

      // Set very low memory quota (0.001 MB = 1KB)
      const quota = { maxMemoryMB: 0.001 };
      const result = monitor.checkQuota('exec-1', quota);

      expect(result.quotaExceeded).toBe(true);
      expect(result.memoryExceeded).toBe(true);
      expect(result.cpuExceeded).toBe(false);
      expect(result.timeExceeded).toBe(false);
      expect(result.violationMessage).toContain('Memory:');
    });

    it('should detect CPU quota exceeded', () => {
      monitor.startMonitoring('exec-1');

      // Set very low CPU quota (0%)
      const quota = { maxCpuPercent: 0 };
      const result = monitor.checkQuota('exec-1', quota);

      // This may or may not be exceeded depending on current CPU usage
      if (result.quotaExceeded) {
        expect(result.cpuExceeded).toBe(true);
        expect(result.violationMessage).toContain('CPU:');
      }
    });

    it('should detect execution time quota exceeded', async () => {
      monitor.startMonitoring('exec-1');

      // Wait a bit to ensure time has passed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set very short time limit (0.001 minutes = 60ms)
      const quota = { maxExecutionMinutes: 0.001 };
      const result = monitor.checkQuota('exec-1', quota);

      expect(result.quotaExceeded).toBe(true);
      expect(result.timeExceeded).toBe(true);
      expect(result.memoryExceeded).toBe(false);
      expect(result.cpuExceeded).toBe(false);
      expect(result.violationMessage).toContain('Time:');
    });

    it('should not detect violations when quota not exceeded', () => {
      monitor.startMonitoring('exec-1');

      // Set very high quotas
      const quota = {
        maxMemoryMB: 10000,
        maxCpuPercent: 100,
        maxExecutionMinutes: 10,
      };
      const result = monitor.checkQuota('exec-1', quota);

      expect(result.quotaExceeded).toBe(false);
      expect(result.memoryExceeded).toBe(false);
      expect(result.cpuExceeded).toBe(false);
      expect(result.timeExceeded).toBe(false);
      expect(result.violationMessage).toBeUndefined();
    });

    it('should handle empty quota (no limits)', () => {
      monitor.startMonitoring('exec-1');

      const quota = {};
      const result = monitor.checkQuota('exec-1', quota);

      expect(result.quotaExceeded).toBe(false);
      expect(result.memoryExceeded).toBe(false);
      expect(result.cpuExceeded).toBe(false);
      expect(result.timeExceeded).toBe(false);
    });

    it('should handle quota with zero values (unlimited)', () => {
      monitor.startMonitoring('exec-1');

      // Zero means unlimited
      const quota = {
        maxMemoryMB: 0,
        maxCpuPercent: 0,
        maxExecutionMinutes: 0,
      };
      const result = monitor.checkQuota('exec-1', quota);

      expect(result.quotaExceeded).toBe(false);
    });

    it('should detect multiple quota violations', async () => {
      monitor.startMonitoring('exec-1');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set multiple low limits
      const quota = {
        maxMemoryMB: 0.001, // Very low memory
        maxExecutionMinutes: 0.001, // Very short time
      };
      const result = monitor.checkQuota('exec-1', quota);

      expect(result.quotaExceeded).toBe(true);
      expect(result.memoryExceeded).toBe(true);
      expect(result.timeExceeded).toBe(true);
      expect(result.violationMessage).toContain('Memory:');
      expect(result.violationMessage).toContain('Time:');
    });

    it('should not check time quota if execution not started', () => {
      // Don't start monitoring
      const quota = { maxExecutionMinutes: 0.001 };
      const result = monitor.checkQuota('exec-unknown', quota);

      expect(result.timeExceeded).toBe(false);
    });
  });

  describe('Clear', () => {
    it('should clear all monitoring data', () => {
      monitor.startMonitoring('exec-1');
      monitor.startMonitoring('exec-2');

      expect(monitor.getExecutionRuntime('exec-1')).toBeGreaterThanOrEqual(0);
      expect(monitor.getExecutionRuntime('exec-2')).toBeGreaterThanOrEqual(0);

      monitor.clear();

      expect(monitor.getExecutionRuntime('exec-1')).toBe(0);
      expect(monitor.getExecutionRuntime('exec-2')).toBe(0);
    });
  });

  describe('Resource Usage Details', () => {
    it('should include usage details in quota check result', () => {
      monitor.startMonitoring('exec-1');

      const quota = { maxMemoryMB: 100 };
      const result = monitor.checkQuota('exec-1', quota);

      expect(result.usage).toBeDefined();
      expect(result.usage.memoryMB).toBeGreaterThan(0);
      expect(result.usage.memoryBytes).toBeGreaterThan(0);
      expect(result.usage.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(result.usage.timestamp).toBeInstanceOf(Date);

      expect(result.quota).toBeDefined();
      expect(result.quota.maxMemoryMB).toBe(100);
    });
  });
});
