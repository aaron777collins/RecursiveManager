/**
 * Stop command - Gracefully stop a running agent
 */

import { Command } from 'commander';
import { header, success, error, info, warning } from '../utils/colors';
import * as fs from 'fs';
import * as path from 'path';

interface StopOptions {
  dataDir?: string;
  force?: boolean;
  timeout?: number;
}

export function registerStopCommand(program: Command): void {
  program
    .command('stop <agent-id>')
    .description('Stop a running agent')
    .option('-d, --data-dir <dir>', 'Custom data directory')
    .option('-f, --force', 'Force kill without graceful shutdown')
    .option('-t, --timeout <ms>', 'Graceful shutdown timeout (default: 10000)', '10000')
    .action(async (agentId: string, options: StopOptions) => {
      try {
        console.log(header('\n⏹ Stopping Agent'));
        console.log();

        const dataDir = options.dataDir || process.env.RECURSIVEMANAGER_DATA_DIR || path.resolve(process.cwd(), '.recursivemanager');
        const pidsDir = path.join(dataDir, 'pids');
        const pidFile = path.join(pidsDir, `${agentId}.pid`);

        if (!fs.existsSync(pidFile)) {
          console.log(warning(`⚠ No PID file found for agent: ${agentId}`));
          console.log(info('The agent may not be running, or was started without --daemon flag'));
          process.exit(1);
        }

        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10);
        console.log(info(`Agent ${agentId} - PID: ${pid}`));
        console.log();

        try {
          process.kill(pid, 0);
        } catch {
          console.log(warning(`⚠ Process ${pid} is not running`));
          console.log(info('Cleaning up stale PID file...'));
          fs.unlinkSync(pidFile);
          console.log(success('✅ Cleanup complete'));
          return;
        }

        if (options.force) {
          console.log(warning('Force killing agent...'));
          try {
            process.kill(pid, 'SIGKILL');
            fs.unlinkSync(pidFile);
            console.log(success('✅ Agent forcefully stopped'));
          } catch (err) {
            console.log(error(`❌ Failed to kill process: ${(err as Error).message}`));
            process.exit(1);
          }
          return;
        }

        console.log(info('Attempting graceful shutdown...'));

        try {
          process.kill(pid, 'SIGTERM');

          const timeout = parseInt(options.timeout as any, 10);
          const startTime = Date.now();

          while (Date.now() - startTime < timeout) {
            try {
              process.kill(pid, 0);
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch {
              break;
            }
          }

          try {
            process.kill(pid, 0);
            console.log(warning(`⚠ Agent did not stop gracefully within ${timeout}ms`));
            console.log(info('Force killing...'));
            process.kill(pid, 'SIGKILL');
          } catch {
            console.log(success('✅ Agent stopped gracefully'));
          }

          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }

          console.log(info('PID file cleaned up'));

        } catch (err) {
          console.log(error(`❌ Error stopping agent: ${(err as Error).message}`));
          process.exit(1);
        }

      } catch (err) {
        console.log(error(`❌ Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
