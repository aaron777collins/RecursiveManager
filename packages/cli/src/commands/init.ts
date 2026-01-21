/**
 * Init command - Initialize RecursiveManager with a goal
 */

import { Command } from 'commander';
import { header, success, error, info, code } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { confirm } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { initializeDatabase, runMigrations, allMigrations, createAgent } from '@recursivemanager/common';

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

        // Determine data directory
        const dataDir =
          options.dataDir ||
          process.env.RECURSIVEMANAGER_DATA_DIR ||
          path.resolve(process.cwd(), '.recursivemanager');

        const markerFile = path.resolve(dataDir, '.recursivemanager');

        // Check if already initialized
        const alreadyInitialized = fs.existsSync(markerFile);
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

        // Create directory structure
        const dirs = ['agents', 'tasks', 'logs', 'snapshots'];
        for (const dir of dirs) {
          const dirPath = path.resolve(dataDir, dir);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
          }
        }

        // Initialize database
        const dbPath = path.resolve(dataDir, 'database.sqlite');
        const dbConnection = initializeDatabase({ path: dbPath });
        const db = dbConnection.db;

        // Run migrations
        const migrationsApplied = runMigrations(db, allMigrations);
        spinner.text = `Initializing RecursiveManager... (applied ${migrationsApplied} migrations)`;

        // Create root CEO agent
        const ceoId = 'ceo-001';
        const ceo = createAgent(db, {
          id: ceoId,
          role: 'CEO',
          displayName: 'CEO',
          createdBy: null,
          reportingTo: null,
          mainGoal: goal,
          configPath: path.resolve(dataDir, 'agents', 'ce', ceoId, 'config.json'),
        });

        // Write marker file
        const markerData = {
          initialized: new Date().toISOString(),
          version: '0.2.0',
        };
        fs.writeFileSync(markerFile, JSON.stringify(markerData, null, 2), { mode: 0o644 });

        // Write configuration file
        const config = {
          dataDir,
          dbPath,
          rootAgentId: ceo.id,
          version: '0.2.0',
          execution: {
            workerPoolSize: 4,
            maxConcurrentTasks: 10,
          },
        };
        const configPath = path.resolve(dataDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o644 });

        // Close database connection
        dbConnection.close();

        spinner.succeed('RecursiveManager initialized successfully');
        console.log();
        console.log(success('Goal set: ') + code(goal));
        console.log(info('Data directory: ') + code(dataDir));
        console.log(info('Root agent: ') + code(`${ceo.display_name} (${ceo.id})`));

        console.log();
        console.log(info('Next steps:'));
        console.log(
          '  1. Run ' + code('recursivemanager status') + ' to view the organization chart'
        );
        console.log('  2. Run ' + code('recursivemanager config') + ' to adjust settings');
        console.log();
      } catch (err) {
        console.error(error('Initialization failed: ' + (err as Error).message));
        process.exit(1);
      }
    });
}
