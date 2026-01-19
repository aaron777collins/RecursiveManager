/**
 * Status command - Show organization chart and agent status
 */

import { Command } from 'commander';
import { header, error, info, code, subheader } from '../utils/colors';
import { createSpinner } from '../utils/spinner';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show organization chart and agent status')
    .option('--agent-id <id>', 'Show details for specific agent')
    .option('--format <format>', 'Output format: tree, json, table', 'tree')
    .option('--depth <depth>', 'Max depth to display', '10')
    .action(async (options: { agentId?: string; format?: string; depth?: string }) => {
      try {
        console.log(header('\n📊 RecursiveManager Status'));
        console.log();

        const spinner = createSpinner('Loading agent hierarchy...');

        // TODO: Implement actual status retrieval logic
        // 1. Load agent hierarchy from file system
        // 2. Format based on options
        // 3. Display organization chart

        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulated delay

        spinner.succeed('Agent hierarchy loaded');
        console.log();

        if (options.agentId) {
          // Show specific agent details
          console.log(subheader(`Agent: ${options.agentId}`));
          console.log();
          console.log('Status:', code('active'));
          console.log('Type:', code('manager'));
          console.log('Parent:', code('root-manager'));
          console.log('Children:', code('3'));
          console.log('Tasks:', code('2 pending, 1 in progress'));
          console.log();
        } else {
          // Show organization chart
          console.log(subheader('Organization Chart:'));
          console.log();
          console.log('📦 root-manager (active)');
          console.log('├─ 📦 sub-manager-1 (active)');
          console.log('│  ├─ 👷 worker-1 (working)');
          console.log('│  └─ 👷 worker-2 (idle)');
          console.log('├─ 📦 sub-manager-2 (active)');
          console.log('│  └─ 👷 worker-3 (working)');
          console.log('└─ 👷 worker-4 (idle)');
          console.log();
          console.log(info('Total agents: ') + code('7'));
          console.log(info('Active agents: ') + code('5'));
          console.log(info('Max depth: ') + code('2'));
          console.log();
        }

        console.log(
          info('Use ' + code('recursive-manager status --agent-id <id>') + ' for details')
        );
        console.log();
      } catch (err) {
        console.error(error('Failed to load status: ' + (err as Error).message));
        process.exit(1);
      }
    });
}
