/**
 * Tests for org chart visualization formatting
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatOrgChart,
  formatAsTree,
  formatAsIndented,
  formatAsTable,
  formatAsJSON,
  type OrgChartEntry,
} from '../formatOrgChart';
import type { AgentRecord } from '@recursive-manager/common';

/**
 * Helper to create a mock agent record
 */
function createMockAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: overrides.id || 'agent-001',
    role: overrides.role || 'TestRole',
    display_name: overrides.display_name || 'Test Agent',
    created_at: overrides.created_at || '2026-01-19T00:00:00Z',
    created_by: overrides.created_by || 'system',
    reporting_to: overrides.reporting_to || null,
    status: overrides.status || 'active',
    main_goal: overrides.main_goal || 'Test goal',
    config_path: overrides.config_path || '/agents/test/config.json',
    last_execution_at: overrides.last_execution_at || null,
    total_executions: overrides.total_executions ?? 0,
    total_runtime_minutes: overrides.total_runtime_minutes ?? 0,
  };
}

/**
 * Helper to create a mock org chart entry
 */
function createMockEntry(
  agentOverrides: Partial<AgentRecord> = {},
  depth: number = 0,
  path: string = 'TestRole'
): OrgChartEntry {
  return {
    agent: createMockAgent(agentOverrides),
    depth,
    path,
  };
}

describe('formatOrgChart', () => {
  describe('formatAsTree', () => {
    it('should format empty org chart', () => {
      const result = formatAsTree([], { useColor: false });
      expect(result).toBe('No agents found.');
    });

    it('should format single agent', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO', role: 'CEO' }, 0, 'CEO'),
      ];

      const result = formatAsTree(orgChart, { useColor: false, showStatus: true });
      expect(result).toContain('● CEO');
    });

    it('should format two-level hierarchy', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO', role: 'CEO' }, 0, 'CEO'),
        createMockEntry({ display_name: 'CTO', role: 'CTO' }, 1, 'CEO/CTO'),
      ];

      const result = formatAsTree(orgChart, { useColor: false, showStatus: true });
      expect(result).toContain('● CEO');
      expect(result).toContain('└─● CTO');
    });

    it('should format multi-level hierarchy with branches', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO', role: 'CEO' }, 0, 'CEO'),
        createMockEntry({ display_name: 'CTO', role: 'CTO' }, 1, 'CEO/CTO'),
        createMockEntry({ display_name: 'Backend Dev', role: 'backend-dev' }, 2, 'CEO/CTO/backend-dev'),
        createMockEntry({ display_name: 'Frontend Dev', role: 'frontend-dev' }, 2, 'CEO/CTO/frontend-dev'),
        createMockEntry({ display_name: 'CFO', role: 'CFO' }, 1, 'CEO/CFO'),
      ];

      const result = formatAsTree(orgChart, { useColor: false, showStatus: true });

      // Check CEO at root
      expect(result).toContain('● CEO');

      // Check CTO branch
      expect(result).toContain('├─● CTO');

      // Check subordinates with proper indentation
      expect(result).toContain('│ ├─● Backend Dev');
      expect(result).toContain('│ └─● Frontend Dev');

      // Check CFO as last branch
      expect(result).toContain('└─● CFO');
    });

    it('should respect maxDepth option', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO' }, 0, 'CEO'),
        createMockEntry({ display_name: 'CTO' }, 1, 'CEO/CTO'),
        createMockEntry({ display_name: 'Dev' }, 2, 'CEO/CTO/Dev'),
      ];

      const result = formatAsTree(orgChart, { useColor: false, maxDepth: 1 });
      expect(result).toContain('CEO');
      expect(result).toContain('CTO');
      expect(result).not.toContain('Dev');
    });

    it('should show status indicators', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'Active', status: 'active' }, 0),
        createMockEntry({ display_name: 'Paused', status: 'paused' }, 0),
        createMockEntry({ display_name: 'Fired', status: 'fired' }, 0),
      ];

      const result = formatAsTree(orgChart, { useColor: false, showStatus: true });
      expect(result).toContain('● Active');  // active
      expect(result).toContain('◐ Paused');  // paused
      expect(result).toContain('○ Fired');   // fired
    });

    it('should show creation dates when requested', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO', created_at: '2026-01-19T12:00:00Z' }, 0),
      ];

      const result = formatAsTree(orgChart, { useColor: false, showCreatedAt: true });
      // Use regex to match any valid date format since toLocaleDateString() is locale-dependent
      expect(result).toMatch(/\[.*19.*2026.*\]|\[.*1\/19\/2026.*\]/);
    });

    it('should show statistics when requested', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({
          display_name: 'CEO',
          total_executions: 10,
          total_runtime_minutes: 120
        }, 0),
      ];

      const result = formatAsTree(orgChart, { useColor: false, showStats: true });
      expect(result).toContain('(10 exec, 120m)');
    });

    it('should not show stats for agents with zero executions', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({
          display_name: 'CEO',
          total_executions: 0,
          total_runtime_minutes: 0
        }, 0),
      ];

      const result = formatAsTree(orgChart, { useColor: false, showStats: true });
      expect(result).not.toContain('exec');
    });
  });

  describe('formatAsIndented', () => {
    it('should format empty org chart', () => {
      const result = formatAsIndented([], { useColor: false });
      expect(result).toBe('No agents found.');
    });

    it('should format with proper indentation', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO', role: 'CEO' }, 0),
        createMockEntry({ display_name: 'CTO', role: 'CTO' }, 1),
        createMockEntry({ display_name: 'Dev', role: 'Dev' }, 2),
      ];

      const result = formatAsIndented(orgChart, { useColor: false, showStatus: false });

      const lines = result.split('\n');
      expect(lines[0]).toBe('CEO');
      expect(lines[1]).toBe('  CTO');
      expect(lines[2]).toBe('    Dev');
    });

    it('should respect maxDepth', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO' }, 0),
        createMockEntry({ display_name: 'CTO' }, 1),
        createMockEntry({ display_name: 'Dev' }, 2),
      ];

      const result = formatAsIndented(orgChart, { useColor: false, maxDepth: 1 });
      expect(result).toContain('CEO');
      expect(result).toContain('CTO');
      expect(result).not.toContain('Dev');
    });
  });

  describe('formatAsTable', () => {
    it('should format empty org chart', () => {
      const result = formatAsTable([], { useColor: false });
      expect(result).toBe('No agents found.');
    });

    it('should format basic table', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO', role: 'CEO' }, 0),
        createMockEntry({ display_name: 'CTO', role: 'CTO' }, 1),
      ];

      const result = formatAsTable(orgChart, {
        useColor: false,
        showStatus: true,
        showCreatedAt: true,
        showStats: true,
      });

      // Check headers
      expect(result).toContain('DEPTH');
      expect(result).toContain('STATUS');
      expect(result).toContain('NAME');
      expect(result).toContain('ROLE');
      expect(result).toContain('CREATED');
      expect(result).toContain('EXECUTIONS');
      expect(result).toContain('RUNTIME');

      // Check separator
      expect(result).toContain('-+-');

      // Check data
      expect(result).toContain('CEO');
      expect(result).toContain('CTO');
    });

    it('should align columns properly', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'A', role: 'Role1' }, 0),
        createMockEntry({ display_name: 'Very Long Name', role: 'Role2' }, 1),
      ];

      const result = formatAsTable(orgChart, { useColor: false, showStatus: false });
      const lines = result.split('\n');

      // All lines should have the same number of separators
      const separatorCount = (lines[0]?.match(/\|/g) || []).length;
      for (const line of lines) {
        if (line.includes('|')) {
          expect((line.match(/\|/g) || []).length).toBe(separatorCount);
        }
      }
    });

    it('should respect maxDepth', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO' }, 0),
        createMockEntry({ display_name: 'CTO' }, 1),
        createMockEntry({ display_name: 'Dev' }, 2),
      ];

      const result = formatAsTable(orgChart, { useColor: false, maxDepth: 1 });
      expect(result).toContain('CEO');
      expect(result).toContain('CTO');
      expect(result).not.toContain('Dev');
    });
  });

  describe('formatAsJSON', () => {
    it('should format empty org chart', () => {
      const result = formatAsJSON([]);
      expect(JSON.parse(result)).toEqual([]);
    });

    it('should format valid JSON', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO', id: 'ceo-001' }, 0, 'CEO'),
      ];

      const result = formatAsJSON(orgChart);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].agent.id).toBe('ceo-001');
      expect(parsed[0].agent.display_name).toBe('CEO');
      expect(parsed[0].depth).toBe(0);
      expect(parsed[0].path).toBe('CEO');
    });

    it('should respect maxDepth', () => {
      const orgChart: OrgChartEntry[] = [
        createMockEntry({ display_name: 'CEO' }, 0),
        createMockEntry({ display_name: 'CTO' }, 1),
        createMockEntry({ display_name: 'Dev' }, 2),
      ];

      const result = formatAsJSON(orgChart, { maxDepth: 1 });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].agent.display_name).toBe('CEO');
      expect(parsed[1].agent.display_name).toBe('CTO');
    });
  });

  describe('formatOrgChart (main function)', () => {
    const sampleOrgChart: OrgChartEntry[] = [
      createMockEntry({ display_name: 'CEO' }, 0),
    ];

    it('should delegate to formatAsTree for tree format', () => {
      const result = formatOrgChart(sampleOrgChart, 'tree', { useColor: false });
      expect(result).toContain('CEO');
    });

    it('should delegate to formatAsIndented for indented format', () => {
      const result = formatOrgChart(sampleOrgChart, 'indented', { useColor: false });
      expect(result).toContain('CEO');
    });

    it('should delegate to formatAsTable for table format', () => {
      const result = formatOrgChart(sampleOrgChart, 'table', { useColor: false });
      expect(result).toContain('DEPTH');
      expect(result).toContain('CEO');
    });

    it('should delegate to formatAsJSON for json format', () => {
      const result = formatOrgChart(sampleOrgChart, 'json');
      const parsed = JSON.parse(result);
      expect(parsed[0].agent.display_name).toBe('CEO');
    });

    it('should throw error for unknown format', () => {
      expect(() => {
        // @ts-expect-error Testing invalid format
        formatOrgChart(sampleOrgChart, 'invalid');
      }).toThrow('Unknown format: invalid');
    });

    it('should use tree format by default', () => {
      const result = formatOrgChart(sampleOrgChart, undefined, { useColor: false });
      // Tree format includes status indicator
      expect(result).toContain('●');
    });
  });
});
