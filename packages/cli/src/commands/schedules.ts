/**
 * Schedules command - Monitor and manage all active schedules globally
 */

import { Command } from 'commander';
import { header, success, error, info, warning, code } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ScheduleInfo {
  projectPath: string;
  projectName: string;
  dataDir: string;
  rootAgentId: string;
  initialized: string;
  pid?: number;
  status: 'active' | 'inactive' | 'zombie';
}

export function registerSchedulesCommand(program: Command): void {
  program
    .command('schedules')
    .description('List all active RecursiveManager schedules globally')
    .option('-a, --all', 'Show all schedules (including inactive)')
    .option('-k, --kill <project>', 'Kill schedule for a specific project')
    .action(async (options: { all?: boolean; kill?: string }) => {
      try {
        console.log(header('\n📅 RecursiveManager Global Schedules'));
        console.log();

        const spinner = createSpinner('Scanning for active schedules...');

        // Find all .recursivemanager directories
        const schedules: ScheduleInfo[] = [];
        const homeDir = os.homedir();
        const commonDirs = [
          homeDir,
          path.join(homeDir, 'repos'),
          path.join(homeDir, 'projects'),
          path.join(homeDir, 'code'),
          '/tmp',
          process.cwd(),
        ];

        // Scan for .recursivemanager directories
        for (const baseDir of commonDirs) {
          if (!fs.existsSync(baseDir)) continue;

          try {
            const files = fs.readdirSync(baseDir);
            for (const file of files) {
              const fullPath = path.join(baseDir, file);
              if (!fs.statSync(fullPath).isDirectory()) continue;

              const rmDir = path.join(fullPath, '.recursivemanager');
              if (fs.existsSync(rmDir)) {
                // Found a RecursiveManager project!
                const configPath = path.join(rmDir, 'config.json');
                const markerPath = path.join(rmDir, '.recursivemanager');

                if (fs.existsSync(configPath)) {
                  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                  const marker = fs.existsSync(markerPath)
                    ? JSON.parse(fs.readFileSync(markerPath, 'utf8'))
                    : {};

                  // Check if there's an active process
                  const pidFile = path.join(rmDir, 'scheduler.pid');
                  let pid: number | undefined;
                  let status: 'active' | 'inactive' | 'zombie' = 'inactive';

                  if (fs.existsSync(pidFile)) {
                    const pidStr = fs.readFileSync(pidFile, 'utf8').trim();
                    pid = parseInt(pidStr);

                    // Check if process is running
                    try {
                      process.kill(pid, 0); // Signal 0 doesn't kill, just checks if process exists
                      status = 'active';
                    } catch {
                      // PID file exists but process is dead - zombie!
                      status = 'zombie';
                    }
                  }

                  schedules.push({
                    projectPath: fullPath,
                    projectName: path.basename(fullPath),
                    dataDir: rmDir,
                    rootAgentId: config.rootAgentId || 'unknown',
                    initialized: marker.initialized || 'unknown',
                    pid,
                    status,
                  });
                }
              }
            }
          } catch (err) {
            // Ignore permission errors, etc.
            continue;
          }
        }

        spinner.stop();

        if (schedules.length === 0) {
          console.log(warning('No RecursiveManager schedules found'));
          console.log();
          console.log(info('To create a schedule, run: ') + code('recursivemanager init "your goal"'));
          console.log();
          return;
        }

        // Filter by status if needed
        const filteredSchedules = options.all
          ? schedules
          : schedules.filter(s => s.status === 'active' || s.status === 'zombie');

        if (filteredSchedules.length === 0 && !options.all) {
          console.log(warning('No active schedules found'));
          console.log();
          console.log(info('Use ') + code('recursivemanager schedules --all') + ' to show all schedules');
          console.log();
          return;
        }

        // Display schedules
        console.log(success(`Found ${filteredSchedules.length} schedule(s):`));
        console.log();

        for (const schedule of filteredSchedules) {
          const statusIcon =
            schedule.status === 'active' ? '🟢' : schedule.status === 'zombie' ? '🟡' : '⚫';
          const statusText =
            schedule.status === 'active'
              ? success('ACTIVE')
              : schedule.status === 'zombie'
              ? warning('ZOMBIE')
              : info('INACTIVE');

          console.log(`${statusIcon} ${code(schedule.projectName)} - ${statusText}`);
          console.log(`   Path: ${schedule.projectPath}`);
          console.log(`   Root Agent: ${schedule.rootAgentId}`);
          console.log(`   Initialized: ${new Date(schedule.initialized).toLocaleString()}`);
          if (schedule.pid) {
            console.log(`   PID: ${schedule.pid}`);
          }
          console.log();
        }

        // Show cleanup suggestions for zombies
        const zombies = filteredSchedules.filter(s => s.status === 'zombie');
        if (zombies.length > 0) {
          console.log(warning(`⚠️  Found ${zombies.length} zombie schedule(s)`));
          console.log(info('These have PID files but the processes are not running.'));
          console.log(info('To clean up: ') + code('recursivemanager schedules --kill <project>'));
          console.log();
        }

        // Kill option
        if (options.kill) {
          const target = schedules.find(s => s.projectName === options.kill);
          if (!target) {
            console.log(error(`Project "${options.kill}" not found`));
            return;
          }

          const pidFile = path.join(target.dataDir, 'scheduler.pid');
          if (fs.existsSync(pidFile)) {
            if (target.pid && target.status === 'active') {
              try {
                process.kill(target.pid, 'SIGTERM');
                console.log(success(`Killed schedule for ${target.projectName} (PID ${target.pid})`));
              } catch (err) {
                console.log(error(`Failed to kill process: ${(err as Error).message}`));
              }
            }
            fs.unlinkSync(pidFile);
            console.log(success(`Cleaned up PID file for ${target.projectName}`));
          } else {
            console.log(warning(`No active schedule for ${target.projectName}`));
          }
        }
      } catch (err) {
        console.error(error('Failed to list schedules: ' + (err as Error).message));
        process.exit(1);
      }
    });
}
