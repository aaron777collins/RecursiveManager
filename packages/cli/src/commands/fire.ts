/**
 * Fire command - Remove agents from hierarchy with subordinate handling
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
  getSubordinates,
} from '@recursive-manager/common';
import { fireAgent, FireStrategy } from '@recursive-manager/core';

interface FireOptions {
  dataDir?: string;
  strategy?: FireStrategy;
  json?: boolean;
  yes?: boolean;
}

export function registerFireCommand(program: Command): void {
  program
    .command('fire <agent-id>')
    .description('Fire an agent and handle their subordinates')
    .option('-d, --data-dir <dir>', 'Custom data directory')
    .option(
      '-s, --strategy <strategy>',
      'Subordinate handling strategy (reassign, promote, cascade)',
      'reassign'
    )
    .option('--json', 'Output result as JSON')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (agentId: string, options: FireOptions) => {
      try {
        console.log(header('\n🔥 Fire Agent'));
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
            console.log(warning(`⚠️  Agent is already fired: ${agentId}`));
            process.exit(0);
          }

          // Check if this is the root agent
          if (!agent.reporting_to) {
            console.log(error(`❌ Cannot fire root agent: ${agentId}`));
            console.log(info('The root agent (CEO) cannot be fired'));
            process.exit(1);
          }

          // Get subordinates
          const subordinates = getSubordinates(db, agentId);

          console.log(info('Agent Details:'));
          console.log(code(`  ID: ${agent.id}`));
          console.log(code(`  Role: ${agent.role}`));
          console.log(code(`  Display Name: ${agent.display_name}`));
          console.log(code(`  Status: ${agent.status}`));
          console.log(code(`  Subordinates: ${subordinates.length}`));
          console.log();

          // Determine strategy
          let strategy: FireStrategy = (options.strategy as FireStrategy) || 'reassign';

          if (subordinates.length > 0 && !options.strategy) {
            console.log(warning(`⚠️  This agent has ${subordinates.length} subordinate(s)`));
            console.log();
            console.log(info('Subordinate handling strategies:'));
            console.log(code('  reassign - Reassign subordinates to this agent\'s manager (default)'));
            console.log(code('  promote  - Promote one subordinate to replace this agent'));
            console.log(code('  cascade  - Fire this agent and all subordinates (dangerous!)'));
            console.log();

            strategy = await select(
              'How should subordinates be handled?',
              [
                { name: 'Reassign to manager (recommended)', value: 'reassign' },
                { name: 'Promote one subordinate', value: 'promote' },
                { name: 'Cascade fire (fire all subordinates too)', value: 'cascade' },
              ],
              0
            );
          }

          // Validate strategy
          const validStrategies: FireStrategy[] = ['reassign', 'promote', 'cascade'];
          if (!validStrategies.includes(strategy)) {
            console.log(error(`❌ Invalid strategy: ${strategy}`));
            console.log(info('Valid strategies: reassign, promote, cascade'));
            process.exit(1);
          }

          console.log();
          console.log(info('Fire Configuration:'));
          console.log(code(`  Strategy: ${strategy}`));
          if (strategy === 'cascade' && subordinates.length > 0) {
            console.log(warning(`  ⚠️  ${subordinates.length} subordinate(s) will also be fired!`));
          }
          console.log();

          // Confirm action unless --yes flag is set
          if (!options.yes) {
            const shouldProceed = await confirm(
              `Are you sure you want to fire ${agent.display_name} (${agent.role})?`,
              false
            );
            if (!shouldProceed) {
              console.log(info('Fire operation cancelled'));
              dbConnection.close();
              return;
            }
          }

          const spinner = createSpinner('Firing agent...');

          // Call fireAgent function
          const result = await fireAgent(db, agentId, strategy, { baseDir: dataDir });

          spinner.succeed('Agent fired successfully!');

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log();
            console.log(success('✅ Agent fired successfully!'));
            console.log();
            console.log(info('Fire Summary:'));
            console.log(code(`  Agent: ${agent.display_name} (${agent.role})`));
            console.log(code(`  Strategy: ${strategy}`));
            console.log(code(`  Orphans Handled: ${result.orphansHandled}`));
            console.log(code(`  Tasks Reassigned: ${result.tasksReassigned}`));
            console.log(code(`  Tasks Archived: ${result.tasksArchived}`));
            console.log(code(`  Files Archived: ${result.filesArchived ? 'Yes' : 'No'}`));
            console.log();

            if (result.orphansHandled > 0) {
              console.log(info('Subordinate Actions:'));
              if (strategy === 'reassign') {
                console.log(code(`  ✓ ${result.orphansHandled} subordinate(s) reassigned to manager`));
              } else if (strategy === 'promote') {
                console.log(code(`  ✓ 1 subordinate promoted to replace ${agent.role}`));
                console.log(code(`  ✓ ${result.orphansHandled - 1} subordinate(s) reassigned`));
              } else if (strategy === 'cascade') {
                console.log(code(`  ✓ ${result.orphansHandled} subordinate(s) also fired`));
              }
              console.log();
            }

            console.log(info('Next Steps:'));
            console.log(code('  - View organization: recursive-manager status'));
            if (agent.reporting_to) {
              console.log(code(`  - View manager: recursive-manager status --agent-id ${agent.reporting_to}`));
            }
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
