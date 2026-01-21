/**
 * Run command - Manually trigger agent execution
 */

import { Command } from 'commander';
import { header, success, error, info, code, warning } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { select, confirm } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeDatabase,
  getAgent,
  DatabasePool,
} from '@recursivemanager/common';
import { ExecutionOrchestrator } from '@recursivemanager/core';
import { AdapterRegistry } from '@recursivemanager/adapters';

interface RunOptions {
  dataDir?: string;
  mode?: 'continuous' | 'reactive';
  json?: boolean;
  yes?: boolean;
  daemon?: boolean;
  timeout?: number;
}

export function registerRunCommand(program: Command): void {
  program
    .command('run <agent-id>')
    .description('Manually trigger agent execution')
    .option('-d, --data-dir <dir>', 'Custom data directory')
    .option('-m, --mode <mode>', 'Execution mode (continuous, reactive)', 'continuous')
    .option('--json', 'Output result as JSON')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--daemon', 'Run agent as background daemon process')
    .option('-t, --timeout <ms>', 'Maximum execution time in ms (default: 300000 for 5 min)', '300000')
    .action(async (agentId: string, options: RunOptions) => {
      try {
        console.log(header('\n▶️  Run Agent'));
        console.log();

        // Determine data directory
        const dataDir =
          options.dataDir ||
          process.env.RECURSIVEMANAGER_DATA_DIR ||
          path.resolve(process.cwd(), '.recursivemanager');

        const markerFile = path.resolve(dataDir, '.recursivemanager');

        // Check if initialized
        if (!fs.existsSync(markerFile)) {
          console.log(error('❌ RecursiveManager is not initialized'));
          console.log(info('Run: recursivemanager init "<your goal>"'));
          process.exit(1);
        }

        // Connect to database
        const dbPath = path.resolve(dataDir, 'database.sqlite');
        if (!fs.existsSync(dbPath)) {
          console.log(error('❌ Database not found'));
          process.exit(1);
        }

        const dbConnection = initializeDatabase({ path: dbPath });
        const db = dbConnection.db;

        try {
          // Verify agent exists
          const agent = getAgent(db, agentId);
          if (!agent) {
            console.log(error(`❌ Agent not found: ${agentId}`));
            process.exit(1);
          }

          if (agent.status === 'fired') {
            console.log(error(`❌ Cannot run fired agent: ${agentId}`));
            process.exit(1);
          }

          console.log(info('Agent Details:'));
          console.log(code(`  ID: ${agent.id}`));
          console.log(code(`  Role: ${agent.role}`));
          console.log(code(`  Display Name: ${agent.display_name}`));
          console.log(code(`  Status: ${agent.status}`));
          console.log();

          // Determine execution mode
          let mode = options.mode || 'continuous';

          if (!options.mode) {
            mode = await select('Execution mode:', [
              { name: 'Continuous - Execute next task from task list', value: 'continuous' },
              { name: 'Reactive - Process messages from inbox', value: 'reactive' },
            ], 0);
          }

          if (mode !== 'continuous' && mode !== 'reactive') {
            console.log(error(`❌ Invalid mode: ${mode}`));
            console.log(info('Valid modes: continuous, reactive'));
            process.exit(1);
          }

          console.log(info('Execution Configuration:'));
          console.log(code(`  Mode: ${mode}`));
          console.log(code(`  Daemon: ${options.daemon ? 'Yes' : 'No'}`));
          console.log();

          // Confirm action unless --yes flag is set
          if (!options.yes) {
            const shouldProceed = await confirm(
              `Execute ${agent.display_name} (${agent.role}) in ${mode} mode?`,
              true
            );
            if (!shouldProceed) {
              console.log(info('Execution cancelled'));
              dbConnection.close();
              return;
            }
          }

          // Daemon mode - spawn background process
          if (options.daemon) {
            console.log(info('Starting agent in daemon mode...'));

            // Create pids directory
            const pidsDir = path.join(dataDir, 'pids');
            if (!fs.existsSync(pidsDir)) {
              fs.mkdirSync(pidsDir, { recursive: true });
            }

            const pidFile = path.join(pidsDir, `${agentId}.pid`);

            // Check if already running
            if (fs.existsSync(pidFile)) {
              const existingPid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10);
              try {
                process.kill(existingPid, 0);
                console.log(warning(`⚠ Agent ${agentId} is already running as PID ${existingPid}`));
                console.log(info('To stop it, run: recursivemanager stop ' + agentId));
                process.exit(1);
              } catch {
                // Process doesn't exist, clean up stale PID file
                fs.unlinkSync(pidFile);
              }
            }

            // Spawn the daemon process
            const { spawn } = require('child_process');

            // Log file location
            const logsDir = path.join(dataDir, 'logs');
            if (!fs.existsSync(logsDir)) {
              fs.mkdirSync(logsDir, { recursive: true });
            }
            const logFile = path.join(logsDir, `${agentId}.log`);

            // Open log file for child process output
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });

            // Spawn process with piped stdio
            const child = spawn(process.argv[0], [
              process.argv[1],
              'run',
              agentId,
              '--mode', mode,
              '--yes',
              '--data-dir', dataDir
            ], {
              detached: true,
              stdio: ['ignore', 'pipe', 'pipe'], // stdin=ignore, stdout=pipe, stderr=pipe
              env: {
                ...process.env,
                RECURSIVEMANAGER_DAEMON: 'true'
              }
            });

            // Redirect output to log file
            if (child.stdout) {
              child.stdout.pipe(logStream);
            }
            if (child.stderr) {
              child.stderr.pipe(logStream);
            }

            // Unref to let parent exit
            child.unref();

            // Save PID
            fs.writeFileSync(pidFile, child.pid.toString());

            console.log(success(`✅ Agent started in daemon mode`));
            console.log(code(`  PID: ${child.pid}`));
            console.log(code(`  Log: ${logFile}`));
            console.log();
            console.log(info('To stop the agent:'));
            console.log(code(`  recursivemanager stop ${agentId}`));
            console.log();
            console.log(info('To view logs:'));
            console.log(code(`  tail -f ${logFile}`));

            dbConnection.close();
            return;
          }

          const spinner = createSpinner(`Executing agent in ${mode} mode...`);

          // Get database pool singleton
          const dbPool = DatabasePool.getInstance();
          dbPool.initialize({ path: dbPath });

          // Create adapter registry
          const adapterRegistry = new AdapterRegistry();

          // Create execution orchestrator
          const orchestrator = new ExecutionOrchestrator({
            adapterRegistry,
            database: dbPool,
            maxExecutionTime: parseInt(options.timeout as any, 10) || 5 * 60 * 1000,
            maxConcurrent: 1,
            baseDir: dataDir,
          });

          try {
            // Execute based on mode
            let result;
            if (mode === 'continuous') {
              result = await orchestrator.executeContinuous(agentId);
            } else {
              result = await orchestrator.executeReactive(agentId, {
                type: 'manual',
                timestamp: new Date(),
              });
            }

            spinner.succeed('Agent execution completed!');

            if (options.json) {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log();
              console.log(success('✅ Agent execution completed!'));
              console.log();
              console.log(info('Execution Summary:'));
              console.log(code(`  Agent: ${agent.display_name} (${agent.role})`));
              console.log(code(`  Mode: ${mode}`));
              console.log(code(`  Status: ${result.success ? 'Success' : 'Failed'}`));
              console.log(code(`  Duration: ${result.duration}ms`));
              if (result.tasksCompleted > 0) {
                console.log(code(`  Tasks Completed: ${result.tasksCompleted}`));
              }
              if (result.messagesProcessed > 0) {
                console.log(code(`  Messages Processed: ${result.messagesProcessed}`));
              }
              if (result.errors && result.errors.length > 0) {
                console.log(code(`  Errors: ${result.errors.length}`));
                result.errors.forEach((err: any, idx: number) => {
                  console.log(code(`    ${idx + 1}. ${err.message}`));
                });
              }
              console.log();

              console.log(info('Next Steps:'));
              console.log(code(`  - View agent: recursivemanager status --agent-id ${agentId}`));
              console.log(code(`  - Debug agent: recursivemanager debug ${agentId} --all`));
              console.log(code(`  - View logs: recursivemanager debug ${agentId} --logs`));
              console.log(code(`  - Run as daemon: recursivemanager run ${agentId} --daemon`));
            }
          } finally {
            // Cleanup database pool
            dbPool.close();
          }
        } finally {
          dbConnection.close();
        }
      } catch (err) {
        console.log();
        console.log(error(`❌ Error: ${(err as Error).message}`));
        if (process.env.DEBUG) {
          console.error(err);
        }
        process.exit(1);
      }
    });
}
