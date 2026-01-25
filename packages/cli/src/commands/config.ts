/**
 * Config command - Configure RecursiveManager settings
 */

import { Command } from 'commander';
import { header, success, error, info, code, subheader } from '../utils/colors';
import { select, number, confirm } from '../utils/prompts';
import {
  loadConfig,
  getConfigPath,
  getNestedValue,
  setNestedValue,
  validateConfig,
} from '../utils/config';
import { writeFileSync } from 'fs';

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Configure RecursiveManager settings')
    .option('--get <key>', 'Get configuration value')
    .option('--set <key=value>', 'Set configuration value')
    .option('--list', 'List all configuration')
    .option('--reset', 'Reset to default configuration')
    .option('--data-dir <dir>', 'Custom data directory')
    .action(async (options: { get?: string; set?: string; list?: boolean; reset?: boolean; dataDir?: string }) => {
      try {
        console.log(header('\n⚙️  RecursiveManager Configuration'));
        console.log();

        if (options.list) {
          // List all configuration
          const config = loadConfig(options.dataDir);
          console.log(subheader('Current Configuration:'));
          console.log();
          console.log(JSON.stringify(config, null, 2));
          console.log();
        } else if (options.get) {
          // Get specific configuration value
          const config = loadConfig(options.dataDir);
          const value = getNestedValue(config, options.get);

          if (value === undefined) {
            console.error(error(`Configuration key '${options.get}' not found`));
            process.exit(1);
          }

          console.log(info(options.get + ': ') + code(JSON.stringify(value)));
          console.log();
        } else if (options.set) {
          // Set configuration value
          const [key, value] = options.set.split('=');
          if (!key || !value) {
            console.error(error('Invalid format. Use: --set key=value'));
            process.exit(1);
          }

          const config = loadConfig(options.dataDir);
          setNestedValue(config, key, value);

          // Validate the updated configuration
          try {
            validateConfig(config);
          } catch (err) {
            console.error(error('Configuration validation failed: ' + (err as Error).message));
            process.exit(1);
          }

          // Save configuration
          const configPath = getConfigPath(options.dataDir);
          writeFileSync(configPath, JSON.stringify(config, null, 2));

          console.log(success(`✅ Set ${key} = ${value}`));
          console.log();
        } else if (options.reset) {
          // Reset configuration
          const shouldReset = await confirm(
            'This will reset all configuration to defaults. Continue?',
            false
          );

          if (shouldReset) {
            console.error(error('Reset functionality not yet implemented. Please reinitialize instead.'));
            process.exit(1);
          } else {
            console.log(info('Reset cancelled'));
            console.log();
          }
        } else {
          // Interactive configuration wizard
          const config = loadConfig(options.dataDir);
          console.log(info('Interactive Configuration Wizard'));
          console.log();

          const action = await select('What would you like to configure?', [
            { name: 'AI Provider (AICEO Gateway)', value: 'ai-provider' },
            { name: 'Execution Settings', value: 'execution' },
            { name: 'View All Settings', value: 'view' },
          ]);

          console.log();

          switch (action) {
            case 'ai-provider':
              console.log();
              console.log(info('AI Provider is configured globally via AICEO Gateway.'));
              console.log();
              console.log('To configure AI Provider settings, run:');
              console.log('  ' + code('recursivemanager setup'));
              console.log();
              console.log('This will launch the AICEO Gateway setup wizard.');
              console.log();
              break;

            case 'execution':
              const workerPoolSize = await number(
                'Worker pool size (1-100):',
                config.execution?.workerPoolSize || 5
              );
              const maxConcurrentTasks = await number(
                'Max concurrent tasks (1-1000):',
                config.execution?.maxConcurrentTasks || 10
              );

              // Update config
              if (!config.execution) {
                config.execution = { workerPoolSize: 5, maxConcurrentTasks: 10 };
              }
              config.execution.workerPoolSize = workerPoolSize;
              config.execution.maxConcurrentTasks = maxConcurrentTasks;

              // Validate
              try {
                validateConfig(config);
              } catch (err) {
                console.error(error('Configuration validation failed: ' + (err as Error).message));
                process.exit(1);
              }

              // Save
              const configPath = getConfigPath(options.dataDir);
              writeFileSync(configPath, JSON.stringify(config, null, 2));

              console.log();
              console.log(success('✅ Execution settings saved'));
              break;

            case 'view':
              // Show all settings
              console.log(subheader('Current Configuration:'));
              console.log();
              console.log(JSON.stringify(config, null, 2));
              break;
          }

          console.log();
        }
      } catch (err) {
        console.error(error('Configuration failed: ' + (err as Error).message));
        process.exit(1);
      }
    });
}
