/**
 * @recursive-manager/cli - Org Chart Visualization
 *
 * Provides formatting utilities for displaying organizational charts
 * in various formats (ASCII tree, table, JSON).
 */

import type { AgentRecord } from '@recursive-manager/common';

/**
 * Represents an org chart entry with hierarchy information
 */
export interface OrgChartEntry {
  agent: AgentRecord;
  depth: number;
  path: string;
}

/**
 * Options for formatting the org chart
 */
export interface FormatOptions {
  /** Include agent status in output */
  showStatus?: boolean;
  /** Include agent creation date */
  showCreatedAt?: boolean;
  /** Include agent execution statistics */
  showStats?: boolean;
  /** Use color codes (ANSI) */
  useColor?: boolean;
  /** Maximum depth to display (0 = all) */
  maxDepth?: number;
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

/**
 * Get status color based on agent status
 */
function getStatusColor(status: string, useColor: boolean): string {
  if (!useColor) return '';

  switch (status) {
    case 'active':
      return COLORS.green;
    case 'paused':
      return COLORS.yellow;
    case 'fired':
      return COLORS.red;
    default:
      return COLORS.gray;
  }
}

/**
 * Get status indicator symbol
 */
function getStatusIndicator(status: string): string {
  switch (status) {
    case 'active':
      return '●';
    case 'paused':
      return '◐';
    case 'fired':
      return '○';
    default:
      return '?';
  }
}

/**
 * Format a single agent entry with optional metadata
 */
function formatAgentEntry(
  entry: OrgChartEntry,
  options: FormatOptions
): string {
  const { agent, depth } = entry;
  const { showStatus = true, showCreatedAt = false, showStats = false, useColor = true } = options;

  const parts: string[] = [];

  // Agent name
  const statusColor = getStatusColor(agent.status, useColor);
  const resetColor = useColor ? COLORS.reset : '';

  if (showStatus) {
    const indicator = getStatusIndicator(agent.status);
    parts.push(`${statusColor}${indicator}${resetColor}`);
  }

  parts.push(`${statusColor}${agent.display_name}${resetColor}`);

  // Role (if different from display name)
  if (agent.role !== agent.display_name) {
    const roleText = useColor ? `${COLORS.gray}(${agent.role})${COLORS.reset}` : `(${agent.role})`;
    parts.push(roleText);
  }

  // Created date
  if (showCreatedAt) {
    const date = new Date(agent.created_at).toLocaleDateString();
    const dateText = useColor ? `${COLORS.gray}${date}${COLORS.reset}` : date;
    parts.push(`[${dateText}]`);
  }

  // Stats
  if (showStats && agent.total_executions > 0) {
    const statsText = useColor
      ? `${COLORS.cyan}(${agent.total_executions} exec, ${agent.total_runtime_minutes}m)${COLORS.reset}`
      : `(${agent.total_executions} exec, ${agent.total_runtime_minutes}m)`;
    parts.push(statsText);
  }

  return parts.join(' ');
}

/**
 * Format org chart as ASCII tree
 *
 * Example output:
 * ```
 * ● CEO (Alice)
 * ├─● CTO (Bob)
 * │ ├─● Backend Dev (Charlie)
 * │ └─● Frontend Dev (Diana)
 * └─● CFO (Eve)
 * ```
 */
export function formatAsTree(
  orgChart: OrgChartEntry[],
  options: FormatOptions = {}
): string {
  const { maxDepth = 0, useColor = true } = options;

  if (orgChart.length === 0) {
    return 'No agents found.';
  }

  const lines: string[] = [];

  // Group by depth and build tree structure
  const byDepth = new Map<number, OrgChartEntry[]>();
  for (const entry of orgChart) {
    if (maxDepth > 0 && entry.depth > maxDepth) continue;

    const entries = byDepth.get(entry.depth) || [];
    entries.push(entry);
    byDepth.set(entry.depth, entries);
  }

  // Track which depths have more items (for drawing vertical lines)
  const depthHasMore = new Map<number, boolean>();

  for (let i = 0; i < orgChart.length; i++) {
    const entry = orgChart[i];
    if (maxDepth > 0 && entry.depth > maxDepth) continue;

    const { depth } = entry;
    const isLast = i === orgChart.length - 1 || (i + 1 < orgChart.length && orgChart[i + 1].depth < depth);

    // Build prefix based on depth
    let prefix = '';
    for (let d = 0; d < depth; d++) {
      if (depthHasMore.get(d)) {
        prefix += '│ ';
      } else {
        prefix += '  ';
      }
    }

    // Add branch characters
    if (depth > 0) {
      prefix += isLast ? '└─' : '├─';
    }

    // Mark if this depth has more items
    depthHasMore.set(depth, !isLast);

    // Format the agent entry
    const agentText = formatAgentEntry(entry, options);
    lines.push(prefix + agentText);
  }

  return lines.join('\n');
}

/**
 * Format org chart as indented list
 *
 * Example output:
 * ```
 * ● CEO (Alice)
 *   ● CTO (Bob)
 *     ● Backend Dev (Charlie)
 *     ● Frontend Dev (Diana)
 *   ● CFO (Eve)
 * ```
 */
export function formatAsIndented(
  orgChart: OrgChartEntry[],
  options: FormatOptions = {}
): string {
  const { maxDepth = 0 } = options;

  if (orgChart.length === 0) {
    return 'No agents found.';
  }

  const lines: string[] = [];

  for (const entry of orgChart) {
    if (maxDepth > 0 && entry.depth > maxDepth) continue;

    const indent = '  '.repeat(entry.depth);
    const agentText = formatAgentEntry(entry, options);
    lines.push(indent + agentText);
  }

  return lines.join('\n');
}

/**
 * Format org chart as table
 *
 * Example output:
 * ```
 * DEPTH | STATUS | NAME             | ROLE            | CREATED
 * ------|--------|------------------|-----------------|------------
 * 0     | ●      | Alice            | CEO             | 2026-01-18
 * 1     | ●      | Bob              | CTO             | 2026-01-18
 * 2     | ●      | Charlie          | Backend Dev     | 2026-01-19
 * ```
 */
export function formatAsTable(
  orgChart: OrgChartEntry[],
  options: FormatOptions = {}
): string {
  const { maxDepth = 0, showStatus = true, showCreatedAt = true, showStats = true, useColor = true } = options;

  if (orgChart.length === 0) {
    return 'No agents found.';
  }

  // Filter by max depth
  const filtered = maxDepth > 0
    ? orgChart.filter(e => e.depth <= maxDepth)
    : orgChart;

  // Calculate column widths
  const maxNameLen = Math.max(8, ...filtered.map(e => e.agent.display_name.length));
  const maxRoleLen = Math.max(8, ...filtered.map(e => e.agent.role.length));

  // Build header
  const headers: string[] = ['DEPTH'];
  if (showStatus) headers.push('STATUS');
  headers.push('NAME', 'ROLE');
  if (showCreatedAt) headers.push('CREATED');
  if (showStats) headers.push('EXECUTIONS', 'RUNTIME');

  // Build rows
  const rows: string[][] = [];
  for (const entry of filtered) {
    const row: string[] = [];
    const statusColor = getStatusColor(entry.agent.status, useColor);
    const resetColor = useColor ? COLORS.reset : '';

    row.push(entry.depth.toString());

    if (showStatus) {
      const indicator = getStatusIndicator(entry.agent.status);
      row.push(`${statusColor}${indicator}${resetColor}`);
    }

    row.push(`${statusColor}${entry.agent.display_name}${resetColor}`);
    row.push(entry.agent.role);

    if (showCreatedAt) {
      const date = new Date(entry.agent.created_at).toLocaleDateString();
      row.push(date);
    }

    if (showStats) {
      row.push(entry.agent.total_executions.toString());
      row.push(`${entry.agent.total_runtime_minutes}m`);
    }

    rows.push(row);
  }

  // Calculate column widths (account for ANSI codes)
  const colWidths = headers.map((header, i) => {
    const contentWidths = rows.map(row => {
      // Remove ANSI codes for width calculation
      const content = row[i].replace(/\x1b\[[0-9;]*m/g, '');
      return content.length;
    });
    return Math.max(header.length, ...contentWidths);
  });

  // Build table
  const lines: string[] = [];

  // Header row
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
  lines.push(headerRow);

  // Separator
  const separator = colWidths.map(w => '-'.repeat(w)).join('-+-');
  lines.push(separator);

  // Data rows
  for (const row of rows) {
    const formattedRow = row.map((cell, i) => {
      // Calculate actual visible width (excluding ANSI codes)
      const visibleWidth = cell.replace(/\x1b\[[0-9;]*m/g, '').length;
      const padding = colWidths[i] - visibleWidth;
      return cell + ' '.repeat(Math.max(0, padding));
    }).join(' | ');
    lines.push(formattedRow);
  }

  return lines.join('\n');
}

/**
 * Format org chart as JSON
 */
export function formatAsJSON(
  orgChart: OrgChartEntry[],
  options: FormatOptions = {}
): string {
  const { maxDepth = 0 } = options;

  const filtered = maxDepth > 0
    ? orgChart.filter(e => e.depth <= maxDepth)
    : orgChart;

  return JSON.stringify(filtered, null, 2);
}

/**
 * Main formatting function that delegates to the appropriate formatter
 */
export function formatOrgChart(
  orgChart: OrgChartEntry[],
  format: 'tree' | 'indented' | 'table' | 'json' = 'tree',
  options: FormatOptions = {}
): string {
  switch (format) {
    case 'tree':
      return formatAsTree(orgChart, options);
    case 'indented':
      return formatAsIndented(orgChart, options);
    case 'table':
      return formatAsTable(orgChart, options);
    case 'json':
      return formatAsJSON(orgChart, options);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

/**
 * Display org chart to console with automatic format detection
 */
export function displayOrgChart(
  orgChart: OrgChartEntry[],
  format: 'tree' | 'indented' | 'table' | 'json' = 'tree',
  options: FormatOptions = {}
): void {
  const output = formatOrgChart(orgChart, format, options);
  console.log(output);
}
