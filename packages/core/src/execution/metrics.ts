/**
 * Prometheus Metrics for RecursiveManager Execution
 *
 * Provides comprehensive metrics collection for monitoring agent execution,
 * performance, and system health.
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

/**
 * Global metrics registry
 * Can be exported for HTTP endpoint exposure
 */
export const metricsRegistry = new Registry();

/**
 * Counter: Total number of feature executions by mode and status
 * Labels: mode (continuous|reactive), status (success|failure), agent_id
 */
export const executionCounter = new Counter({
  name: 'recursive_manager_executions_total',
  help: 'Total number of feature executions',
  labelNames: ['mode', 'status', 'agent_id'],
  registers: [metricsRegistry],
});

/**
 * Histogram: Execution duration in milliseconds
 * Labels: mode (continuous|reactive), agent_id
 * Buckets: 100ms, 500ms, 1s, 5s, 10s, 30s, 60s, 120s, 300s
 */
export const executionDuration = new Histogram({
  name: 'recursive_manager_execution_duration_ms',
  help: 'Feature execution duration in milliseconds',
  labelNames: ['mode', 'agent_id'],
  buckets: [100, 500, 1000, 5000, 10000, 30000, 60000, 120000, 300000],
  registers: [metricsRegistry],
});

/**
 * Counter: Total tasks completed by agents
 * Labels: agent_id
 */
export const tasksCompletedCounter = new Counter({
  name: 'recursive_manager_tasks_completed_total',
  help: 'Total number of tasks completed by agents',
  labelNames: ['agent_id'],
  registers: [metricsRegistry],
});

/**
 * Counter: Total messages processed by agents
 * Labels: agent_id
 */
export const messagesProcessedCounter = new Counter({
  name: 'recursive_manager_messages_processed_total',
  help: 'Total number of messages processed by agents',
  labelNames: ['agent_id'],
  registers: [metricsRegistry],
});

/**
 * Gauge: Current number of active executions
 */
export const activeExecutionsGauge = new Gauge({
  name: 'recursive_manager_active_executions',
  help: 'Current number of active executions',
  registers: [metricsRegistry],
});

/**
 * Gauge: Current execution queue depth
 */
export const queueDepthGauge = new Gauge({
  name: 'recursive_manager_queue_depth',
  help: 'Current number of tasks waiting in execution queue',
  registers: [metricsRegistry],
});

/**
 * Histogram: Queue wait time in milliseconds
 * Buckets: 10ms, 50ms, 100ms, 500ms, 1s, 5s, 10s, 30s
 */
export const queueWaitTime = new Histogram({
  name: 'recursive_manager_queue_wait_time_ms',
  help: 'Time tasks spend waiting in queue before execution',
  buckets: [10, 50, 100, 500, 1000, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

/**
 * Counter: Total quota violations (resource limits exceeded)
 * Labels: violation_type (memory|cpu|time)
 */
export const quotaViolationsCounter = new Counter({
  name: 'recursive_manager_quota_violations_total',
  help: 'Total number of resource quota violations',
  labelNames: ['violation_type', 'agent_id'],
  registers: [metricsRegistry],
});

/**
 * Gauge: Agent health score (0-100)
 * Labels: agent_id
 */
export const agentHealthGauge = new Gauge({
  name: 'recursive_manager_agent_health_score',
  help: 'Agent health score (0-100)',
  labelNames: ['agent_id'],
  registers: [metricsRegistry],
});

/**
 * Counter: Multi-perspective analysis executions
 * Labels: status (success|failure)
 */
export const analysisCounter = new Counter({
  name: 'recursive_manager_analysis_executions_total',
  help: 'Total number of multi-perspective analysis executions',
  labelNames: ['status'],
  registers: [metricsRegistry],
});

/**
 * Histogram: Multi-perspective analysis duration in milliseconds
 * Buckets: 500ms, 1s, 5s, 10s, 30s, 60s, 120s
 */
export const analysisDuration = new Histogram({
  name: 'recursive_manager_analysis_duration_ms',
  help: 'Multi-perspective analysis duration in milliseconds',
  buckets: [500, 1000, 5000, 10000, 30000, 60000, 120000],
  registers: [metricsRegistry],
});

/**
 * Helper function to record execution metrics
 */
export function recordExecution(params: {
  mode: 'continuous' | 'reactive';
  agentId: string;
  durationMs: number;
  success: boolean;
  tasksCompleted?: number;
  messagesProcessed?: number;
}): void {
  const { mode, agentId, durationMs, success, tasksCompleted = 0, messagesProcessed = 0 } = params;

  // Record execution count
  executionCounter.inc({
    mode,
    status: success ? 'success' : 'failure',
    agent_id: agentId,
  });

  // Record execution duration
  executionDuration.observe(
    {
      mode,
      agent_id: agentId,
    },
    durationMs
  );

  // Record tasks completed
  if (tasksCompleted > 0) {
    tasksCompletedCounter.inc({ agent_id: agentId }, tasksCompleted);
  }

  // Record messages processed
  if (messagesProcessed > 0) {
    messagesProcessedCounter.inc({ agent_id: agentId }, messagesProcessed);
  }
}

/**
 * Helper function to record analysis metrics
 */
export function recordAnalysis(params: {
  durationMs: number;
  success: boolean;
}): void {
  const { durationMs, success } = params;

  analysisCounter.inc({
    status: success ? 'success' : 'failure',
  });

  analysisDuration.observe(durationMs);
}

/**
 * Helper function to update pool metrics
 */
export function updatePoolMetrics(params: {
  activeExecutions: number;
  queueDepth: number;
}): void {
  const { activeExecutions, queueDepth } = params;

  activeExecutionsGauge.set(activeExecutions);
  queueDepthGauge.set(queueDepth);
}

/**
 * Helper function to record queue wait time
 */
export function recordQueueWaitTime(waitTimeMs: number): void {
  queueWaitTime.observe(waitTimeMs);
}

/**
 * Helper function to record quota violations
 */
export function recordQuotaViolation(violationType: 'memory' | 'cpu' | 'time', agentId: string): void {
  quotaViolationsCounter.inc({
    violation_type: violationType,
    agent_id: agentId,
  });
}

/**
 * Helper function to update agent health score
 */
export function updateAgentHealth(agentId: string, healthScore: number): void {
  agentHealthGauge.set({ agent_id: agentId }, healthScore);
}

/**
 * Get metrics in Prometheus format
 * Useful for exposing metrics via HTTP endpoint
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}
