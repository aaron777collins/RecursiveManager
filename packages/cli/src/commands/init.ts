/**
 * Init command - Initialize RecursiveManager with a goal
 */

import { Command } from 'commander';
import { header, success, error, info, code } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { confirm } from '../utils/prompts';

export function registerInitCommand(program: Command): void {
  program
    .command('init <goal>')
    .description('Initialize RecursiveManager with a goal')
    .option('-d, --data-dir <dir>', 'Custom data directory')
    .option('-f, --force', 'Force initialization (overwrite existing)')
    .action(async (goal: string, options: { dataDir?: string; force?: boolean }) => {
      try {
        console.log(header('\n🚀 RecursiveManager Initialization'));
        console.log();

        // Check if already initialized
        const alreadyInitialized = false; // TODO: Check actual state
        if (alreadyInitialized && !options.force) {
          const shouldContinue = await confirm(
            'RecursiveManager is already initialized. Overwrite?',
            false
          );
          if (!shouldContinue) {
            console.log(info('Initialization cancelled'));
            return;
          }
        }

        const spinner = createSpinner('Initializing RecursiveManager...');

        // TODO: Implement actual initialization logic
        // 1. Create data directory structure
        // 2. Initialize agent hierarchy
        // 3. Set up configuration
        // 4. Create root manager agent with goal

        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay

        spinner.succeed('RecursiveManager initialized successfully');
        console.log();
        console.log(success('Goal set: ') + code(goal));

        if (options.dataDir) {
          console.log(info('Data directory: ') + code(options.dataDir));
        }

        console.log();
        console.log(info('Next steps:'));
        console.log('  1. Run ' + code('recursive-manager status') + ' to view the organization chart');
        console.log('  2. Run ' + code('recursive-manager config') + ' to adjust settings');
        console.log();

      } catch (err) {
        console.error(error('Initialization failed: ' + (err as Error).message));
        process.exit(1);
      }
    });
}
