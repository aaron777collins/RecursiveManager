/**
 * Status command - Show organization chart and agent status
 */

import { Command } from 'commander';
import { header, error, info, code, subheader } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { loadConfig } from '../utils/config';
import { initializeDatabase, getOrgChart, getAgent, getSubordinates, getActiveTasks, type TaskRecord } from '@recursive-manager/common';
import { formatOrgChart } from '../utils/formatOrgChart';
import type { OrgChartEntry } from '../utils/formatOrgChart';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show organization chart and agent status')
    .option('--agent-id <id>', 'Show details for specific agent')
    .option('--format <format>', 'Output format: tree, json, table', 'tree')
    .option('--depth <depth>', 'Max depth to display', '10')
    .option('--data-dir <dir>', 'Custom data directory')
    .action(async (options: { agentId?: string; format?: string; depth?: string; dataDir?: string }) => {
      let dbConnection;
      try {
        console.log(header('\n📊 RecursiveManager Status'));
        console.log();

        const spinner = createSpinner('Loading agent hierarchy...');

        // Load configuration
        const config = loadConfig(options.dataDir);

        // Initialize database connection
        dbConnection = initializeDatabase({ path: config.dbPath });
        const db = dbConnection.db;

        spinner.succeed('Agent hierarchy loaded');
        console.log();

        if (options.agentId) {
          // Show specific agent details
          const agent = getAgent(db, options.agentId);

          if (!agent) {
            console.error(error(`Agent ${options.agentId} not found`));
            process.exit(1);
          }

          console.log(subheader(`Agent: ${agent.display_name} (${agent.id})`));
          console.log();
          console.log('Status:', code(agent.status));
          console.log('Role:', code(agent.role));
          console.log('Manager:', code(agent.reporting_to || 'None (root agent)'));

          // Count subordinates
          const subordinates = getSubordinates(db, agent.id);
          console.log('Direct Reports:', code(subordinates.length.toString()));

          // Get tasks
          const tasks = getActiveTasks(db, agent.id);
          const pendingCount = tasks.filter((t: TaskRecord) => t.status === 'pending').length;
          const inProgressCount = tasks.filter((t: TaskRecord) => t.status === 'in_progress').length;
          console.log('Tasks:', code(`${pendingCount} pending, ${inProgressCount} in progress`));

          // Execution stats
          if (agent.total_executions > 0) {
            console.log('Executions:', code(`${agent.total_executions} (${agent.total_runtime_minutes} min total)`));
          }

          console.log();
        } else {
          // Show organization chart
          const orgChart = getOrgChart(db);

          if (orgChart.length === 0) {
            console.log(info('No agents found. Use ' + code('recursive-manager init "<goal>"') + ' to get started.'));
            console.log();
            return;
          }

          console.log(subheader('Organization Chart:'));
          console.log();

          // Parse format and depth options
          const format = (options.format || 'tree') as 'tree' | 'json' | 'table';
          const maxDepth = parseInt(options.depth || '10', 10);

          // Format and display the org chart
          const formattedChart = formatOrgChart(orgChart, format, {
            showStatus: true,
            showStats: format === 'table',
            showCreatedAt: format === 'table',
            useColor: true,
            maxDepth: maxDepth > 0 ? maxDepth : undefined,
          });

          console.log(formattedChart);
          console.log();

          // Summary statistics
          const activeAgents = orgChart.filter((e: OrgChartEntry) => e.agent.status === 'active').length;
          const pausedAgents = orgChart.filter((e: OrgChartEntry) => e.agent.status === 'paused').length;
          const maxDepthActual = Math.max(...orgChart.map((e: OrgChartEntry) => e.depth));

          console.log(info('Total agents: ') + code(orgChart.length.toString()));
          console.log(info('Active: ') + code(activeAgents.toString()) + info(' Paused: ') + code(pausedAgents.toString()));
          console.log(info('Max depth: ') + code(maxDepthActual.toString()));
          console.log();
        }

        console.log(
          info('Use ' + code('recursive-manager status --agent-id <id>') + ' for details')
        );
        console.log();
      } catch (err) {
        console.error(error('Failed to load status: ' + (err as Error).message));
        process.exit(1);
      } finally {
        // Always close database connection
        if (dbConnection) {
          dbConnection.close();
        }
      }
    });
}
