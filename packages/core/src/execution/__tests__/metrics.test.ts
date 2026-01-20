/**
 * Tests for Prometheus metrics collection
 */

import {
  recordExecution,
  recordAnalysis,
  updatePoolMetrics,
  recordQueueWaitTime,
  recordQuotaViolation,
  updateAgentHealth,
  getMetrics,
  resetMetrics,
  executionCounter,
  executionDuration,
  tasksCompletedCounter,
  messagesProcessedCounter,
  activeExecutionsGauge,
  queueDepthGauge,
  agentHealthGauge,
} from '../metrics';

describe('Prometheus Metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    resetMetrics();
  });

  describe('recordExecution', () => {
    it('should record successful continuous execution', async () => {
      recordExecution({
        mode: 'continuous',
        agentId: 'test-agent-1',
        durationMs: 1500,
        success: true,
        tasksCompleted: 5,
        messagesProcessed: 3,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_executions_total');
      expect(metrics).toContain('mode="continuous"');
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('agent_id="test-agent-1"');
      expect(metrics).toContain('recursive_manager_execution_duration_ms');
      expect(metrics).toContain('recursive_manager_tasks_completed_total');
      expect(metrics).toContain('recursive_manager_messages_processed_total');
    });

    it('should record failed reactive execution', async () => {
      recordExecution({
        mode: 'reactive',
        agentId: 'test-agent-2',
        durationMs: 500,
        success: false,
        tasksCompleted: 0,
        messagesProcessed: 0,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_executions_total');
      expect(metrics).toContain('mode="reactive"');
      expect(metrics).toContain('status="failure"');
      expect(metrics).toContain('agent_id="test-agent-2"');
    });

    it('should handle zero tasks and messages', async () => {
      recordExecution({
        mode: 'continuous',
        agentId: 'test-agent-3',
        durationMs: 100,
        success: true,
        tasksCompleted: 0,
        messagesProcessed: 0,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_executions_total');
      // Zero counters shouldn't be incremented
    });
  });

  describe('recordAnalysis', () => {
    it('should record successful analysis', async () => {
      recordAnalysis({
        durationMs: 5000,
        success: true,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_analysis_executions_total');
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('recursive_manager_analysis_duration_ms');
    });

    it('should record failed analysis', async () => {
      recordAnalysis({
        durationMs: 2000,
        success: false,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_analysis_executions_total');
      expect(metrics).toContain('status="failure"');
    });
  });

  describe('updatePoolMetrics', () => {
    it('should update pool metrics', async () => {
      updatePoolMetrics({
        activeExecutions: 5,
        queueDepth: 10,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_active_executions');
      expect(metrics).toContain('recursive_manager_queue_depth');
    });

    it('should handle zero values', async () => {
      updatePoolMetrics({
        activeExecutions: 0,
        queueDepth: 0,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_active_executions 0');
      expect(metrics).toContain('recursive_manager_queue_depth 0');
    });
  });

  describe('recordQueueWaitTime', () => {
    it('should record queue wait time', async () => {
      recordQueueWaitTime(250);

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_queue_wait_time_ms');
    });
  });

  describe('recordQuotaViolation', () => {
    it('should record memory quota violation', async () => {
      recordQuotaViolation('memory', 'test-agent-4');

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_quota_violations_total');
      expect(metrics).toContain('violation_type="memory"');
      expect(metrics).toContain('agent_id="test-agent-4"');
    });

    it('should record CPU quota violation', async () => {
      recordQuotaViolation('cpu', 'test-agent-5');

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_quota_violations_total');
      expect(metrics).toContain('violation_type="cpu"');
      expect(metrics).toContain('agent_id="test-agent-5"');
    });

    it('should record time quota violation', async () => {
      recordQuotaViolation('time', 'test-agent-6');

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_quota_violations_total');
      expect(metrics).toContain('violation_type="time"');
      expect(metrics).toContain('agent_id="test-agent-6"');
    });
  });

  describe('updateAgentHealth', () => {
    it('should update agent health score', async () => {
      updateAgentHealth('test-agent-7', 85);

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_agent_health_score');
      expect(metrics).toContain('agent_id="test-agent-7"');
      expect(metrics).toContain(' 85');
    });

    it('should handle zero health score', async () => {
      updateAgentHealth('test-agent-8', 0);

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_agent_health_score');
      expect(metrics).toContain('agent_id="test-agent-8"');
      expect(metrics).toContain(' 0');
    });

    it('should handle maximum health score', async () => {
      updateAgentHealth('test-agent-9', 100);

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_agent_health_score');
      expect(metrics).toContain('agent_id="test-agent-9"');
      expect(metrics).toContain(' 100');
    });
  });

  describe('getMetrics', () => {
    it('should return Prometheus format', async () => {
      recordExecution({
        mode: 'continuous',
        agentId: 'test-agent-10',
        durationMs: 1000,
        success: true,
        tasksCompleted: 1,
        messagesProcessed: 1,
      });

      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });

    it('should return empty metrics when nothing recorded', async () => {
      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      // Should still have metric definitions even if no data
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', async () => {
      // Record some metrics
      recordExecution({
        mode: 'continuous',
        agentId: 'test-agent-11',
        durationMs: 1000,
        success: true,
        tasksCompleted: 1,
        messagesProcessed: 1,
      });
      updateAgentHealth('test-agent-11', 90);

      // Reset
      resetMetrics();

      // Verify metrics are reset
      const metrics = await getMetrics();
      // After reset, metrics should be back to initial state
      expect(metrics).toBeDefined();
    });
  });

  describe('multiple operations', () => {
    it('should track multiple executions', async () => {
      // Record multiple executions
      for (let i = 0; i < 5; i++) {
        recordExecution({
          mode: 'continuous',
          agentId: 'test-agent-12',
          durationMs: 1000 + i * 100,
          success: true,
          tasksCompleted: i + 1,
          messagesProcessed: i,
        });
      }

      const metrics = await getMetrics();
      expect(metrics).toContain('recursive_manager_executions_total');
      expect(metrics).toContain('recursive_manager_execution_duration_ms');
    });

    it('should track different agent IDs separately', async () => {
      recordExecution({
        mode: 'continuous',
        agentId: 'agent-a',
        durationMs: 1000,
        success: true,
        tasksCompleted: 1,
        messagesProcessed: 1,
      });

      recordExecution({
        mode: 'continuous',
        agentId: 'agent-b',
        durationMs: 2000,
        success: true,
        tasksCompleted: 2,
        messagesProcessed: 2,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('agent_id="agent-a"');
      expect(metrics).toContain('agent_id="agent-b"');
    });

    it('should track success and failure separately', async () => {
      recordExecution({
        mode: 'continuous',
        agentId: 'test-agent-13',
        durationMs: 1000,
        success: true,
        tasksCompleted: 1,
        messagesProcessed: 1,
      });

      recordExecution({
        mode: 'continuous',
        agentId: 'test-agent-13',
        durationMs: 500,
        success: false,
        tasksCompleted: 0,
        messagesProcessed: 0,
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('status="failure"');
    });
  });
});
