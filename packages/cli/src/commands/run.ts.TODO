/**
 * Run command - Manually trigger agent execution
 */

import { Command } from 'commander';
import { header, success, error, info, code } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { select, confirm } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeDatabase,
  getAgent,
  DatabasePool,
} from '@recursive-manager/common';
import { ExecutionOrchestrator } from '@recursive-manager/core';
import { AdapterRegistry } from '@recursive-manager/adapters';

interface RunOptions {
  dataDir?: string;
  mode?: 'continuous' | 'reactive';
  json?: boolean;
  yes?: boolean;
}

export function registerRunCommand(program: Command): void {
  program
    .command('run <agent-id>')
    .description('Manually trigger agent execution')
    .option('-d, --data-dir <dir>', 'Custom data directory')
    .option('-m, --mode <mode>', 'Execution mode (continuous, reactive)', 'continuous')
    .option('--json', 'Output result as JSON')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (agentId: string, options: RunOptions) => {
      try {
        console.log(header('\n▶️  Run Agent'));
        console.log();

        // Determine data directory
        const dataDir =
          options.dataDir ||
          process.env.RECURSIVE_MANAGER_DATA_DIR ||
          path.resolve(process.cwd(), '.recursive-manager');

        const markerFile = path.resolve(dataDir, '.recursive-manager');

        // Check if initialized
        if (!fs.existsSync(markerFile)) {
          console.log(error('❌ RecursiveManager is not initialized'));
          console.log(info('Run: recursive-manager init "<your goal>"'));
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

          const spinner = createSpinner(`Executing agent in ${mode} mode...`);

          // Create database pool
          const dbPool = new DatabasePool(() => initializeDatabase({ path: dbPath }));

          // Create adapter registry
          const adapterRegistry = new AdapterRegistry();

          // Create execution orchestrator
          const orchestrator = new ExecutionOrchestrator({
            adapterRegistry,
            database: dbPool,
            maxExecutionTime: 5 * 60 * 1000, // 5 minutes
            maxConcurrent: 1, // Single execution for manual trigger
          });

          try {
            // Execute based on mode
            let result;
            if (mode === 'continuous') {
              result = await orchestrator.executeContinuous(agentId);
            } else {
              result = await orchestrator.executeReactive(agentId, {
                type: 'manual',
                timestamp: new Date().toISOString(),
                priority: 'normal',
                source: 'cli',
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
              console.log(code(`  Duration: ${result.duration_ms}ms`));
              if (result.tasks_completed) {
                console.log(code(`  Tasks Completed: ${result.tasks_completed}`));
              }
              if (result.messages_processed) {
                console.log(code(`  Messages Processed: ${result.messages_processed}`));
              }
              if (result.error) {
                console.log(code(`  Error: ${result.error}`));
              }
              console.log();

              console.log(info('Next Steps:'));
              console.log(code(`  - View agent: recursive-manager status --agent-id ${agentId}`));
              console.log(code(`  - Debug agent: recursive-manager debug ${agentId} --all`));
              console.log(code(`  - View logs: recursive-manager debug ${agentId} --logs`));
            }
          } finally {
            // Cleanup database pool
            dbPool.closeAll();
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
