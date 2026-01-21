/**
 * Init command - Initialize RecursiveManager with a goal
 */

import { Command } from 'commander';
import { header, success, error, info, code } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { confirm } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { initializeDatabase, runMigrations, allMigrations, createAgent, getAgentShard } from '@recursivemanager/common';

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
        // Compute correct shard for CEO agent
        const ceoShard = getAgentShard(ceoId);

        const ceo = createAgent(db, {
          id: ceoId,
          role: 'CEO',
          displayName: 'CEO',
          createdBy: null,
          reportingTo: null,
          mainGoal: goal,
          configPath: path.resolve(dataDir, 'agents', ceoShard, ceoId, 'config.json'),
        });

        // Create CEO agent workspace
        const ceoWorkspacePath = path.resolve(dataDir, 'agents', ceoShard, ceoId);
        const ceoDirs = ['workspace', 'tasks', 'notes', 'inbox'];
        for (const dir of ceoDirs) {
          const dirPath = path.resolve(ceoWorkspacePath, dir);
          fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
        }

        // Create CEO config file with complete schema-compliant structure
        const ceoConfig = {
          version: '0.2.0',
          identity: {
            id: ceo.id,
            role: ceo.role,
            displayName: ceo.display_name,
            createdAt: new Date().toISOString(),
            createdBy: 'system',
            reportingTo: null,
          },
          goal: {
            mainGoal: goal,
            subGoals: [],
            successCriteria: [],
          },
          permissions: {
            canHire: true,
            maxSubordinates: 10,
            hiringBudget: 100000,
            canFire: true,
            canEscalate: false,
            canAccessExternalAPIs: true,
            maxDelegationDepth: 5,
            canSelfModify: false,
            workspaceQuotaMB: 1024,
            maxExecutionMinutes: 60,
          },
          framework: {
            primary: 'claude-code',
            capabilities: ['code-generation', 'file-operations', 'bash-execution'],
          },
          communication: {
            preferredChannels: ['internal'],
            updateFrequency: 'daily',
            notifyOnDelegation: true,
            notifyOnEscalation: true,
            notifyOnCompletion: true,
          },
          behavior: {
            verbosity: 3,
            continuousMode: true,
            autoEscalateBlockedTasks: true,
            escalationTimeoutMinutes: 60,
          },
        };
        fs.writeFileSync(ceo.config_path, JSON.stringify(ceoConfig, null, 2), { mode: 0o644 });

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

        // Create .gitignore
        const gitignorePath = path.resolve(process.cwd(), '.gitignore');
        const gitignoreContent = `
# RecursiveManager - Security: Exclude sensitive files
.recursivemanager/logs/
.recursivemanager/.env
.recursivemanager/database.sqlite
.recursivemanager/database.sqlite-shm
.recursivemanager/database.sqlite-wal

# Keep project structure
!.recursivemanager/config.json
!.recursivemanager/agents/
!.recursivemanager/snapshots/
`;

        if (fs.existsSync(gitignorePath)) {
          // Append to existing .gitignore
          const existing = fs.readFileSync(gitignorePath, 'utf8');
          if (!existing.includes('.recursivemanager/logs/')) {
            fs.appendFileSync(gitignorePath, gitignoreContent);
          }
        } else {
          // Create new .gitignore
          fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', { mode: 0o644 });
        }

        // Close database connection
        dbConnection.close();

        spinner.succeed('RecursiveManager initialized successfully');
        console.log();
        console.log(success('Goal set: ') + code(goal));
        console.log(info('Data directory: ') + code(dataDir));
        console.log(info('Root agent: ') + code(`${ceo.display_name} (${ceo.id})`));
        console.log(info('.gitignore: ') + code('Created/Updated'));

        console.log();
        console.log(info('🔒 SECURITY NOTICE:'));
        console.log('  • Logs and database are excluded from git');
        console.log('  • API keys stored in ~/.recursivemanager/.env');
        console.log('  • Review .gitignore before committing');

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
