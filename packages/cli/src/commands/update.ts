/**
 * Update command - Self-update RecursiveManager
 */

import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import { header, success, error, info, code, warning } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { confirm } from '../utils/prompts';
import { getScriptPath } from '../utils/paths';
import { VERSION } from '../index';

const execAsync = promisify(exec);

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update RecursiveManager to the latest version')
    .option('--check', 'Check for updates without installing')
    .option('--version <version>', 'Install specific version')
    .action(async (options: { check?: boolean; version?: string }) => {
      try {
        console.log(header('\n🔄 RecursiveManager Update'));
        console.log();
        console.log(info('Current version: ') + code(VERSION));
        console.log();

        // Find update.sh script using installation root detection
        const scriptPath = getScriptPath('update.sh');

        if (options.check) {
          // Check for updates only
          const spinner = createSpinner('Checking for updates...');

          try {
            const { stdout } = await execAsync(`bash "${scriptPath}" --check`);
            spinner.succeed('Update check complete');
            console.log();
            console.log(stdout.trim());
          } catch (err) {
            spinner.fail('Update check failed');
            throw err;
          }
        } else {
          // Perform update
          const spinner = createSpinner('Checking for updates...');

          try {
            // Check if update is available
            const { stdout: checkOutput } = await execAsync(`bash "${scriptPath}" --check`);
            spinner.succeed('Update check complete');

            if (checkOutput.includes('already running the latest version')) {
              console.log();
              console.log(success('You are already running the latest version'));
              return;
            }

            console.log();
            console.log(checkOutput.trim());
            console.log();

            // Confirm update
            const shouldUpdate = await confirm('Would you like to update now?', true);
            if (!shouldUpdate) {
              console.log(info('Update cancelled'));
              return;
            }

            console.log();
            const updateSpinner = createSpinner('Updating RecursiveManager...');

            const updateCommand = options.version
              ? `bash "${scriptPath}" "${options.version}"`
              : `bash "${scriptPath}"`;

            const { stdout: updateOutput } = await execAsync(updateCommand);
            updateSpinner.succeed('Update complete');

            console.log();
            console.log(updateOutput.trim());
            console.log();
            console.log(success('RecursiveManager has been updated successfully!'));
            console.log();
            console.log(
              info('Restart any running RecursiveManager processes to use the new version')
            );
            console.log();
          } catch (err) {
            spinner.fail('Update failed');
            throw err;
          }
        }
      } catch (err) {
        console.error(error('Update failed: ' + (err as Error).message));
        console.log();
        console.log(warning('You can also update manually using:'));
        console.log(code('  cd ~/.recursivemanager && git pull && npm install && npm run build'));
        console.log();
        process.exit(1);
      }
    });
}
