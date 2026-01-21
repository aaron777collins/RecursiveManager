/**
 * Hire command - Create and assign new agents to the hierarchy
 */

import { Command } from 'commander';
import { header, success, error, info, code } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { input, select, confirm, number } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeDatabase,
  getAgent,
  AgentConfig,
} from '@recursivemanager/common';
import { hireAgent } from '@recursivemanager/core';
import * as crypto from 'crypto';

interface HireOptions {
  dataDir?: string;
  managerId?: string;
  role?: string;
  goal?: string;
  displayName?: string;
  canHire?: boolean;
  maxSubordinates?: number;
  hiringBudget?: number;
  canFire?: boolean;
  canEscalate?: boolean;
  framework?: string;
  json?: boolean;
}

export function registerHireCommand(program: Command): void {
  program
    .command('hire')
    .description('Hire a new agent and add to organizational hierarchy')
    .option('-d, --data-dir <dir>', 'Custom data directory')
    .option('-m, --manager-id <id>', 'Manager agent ID (defaults to CEO)')
    .option('-r, --role <role>', 'Agent role (e.g., CTO, Engineer)')
    .option('-g, --goal <goal>', 'Agent main goal')
    .option('-n, --display-name <name>', 'Agent display name')
    .option('--can-hire', 'Agent can hire subordinates')
    .option('--max-subordinates <n>', 'Maximum subordinates', parseInt)
    .option('--hiring-budget <n>', 'Hiring budget for subordinates', parseInt)
    .option('--can-fire', 'Agent can fire subordinates')
    .option('--can-escalate', 'Agent can escalate to manager')
    .option('-f, --framework <framework>', 'Execution framework (claude-code, opencode)')
    .option('--json', 'Output result as JSON')
    .action(async (options: HireOptions) => {
      try {
        console.log(header('\n👔 Hire New Agent'));
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
          // Get manager ID (default to CEO if not specified)
          let managerId = options.managerId;
          if (!managerId) {
            // Load config to get root agent ID
            const configPath = path.resolve(dataDir, 'config.json');
            if (fs.existsSync(configPath)) {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              managerId = config.rootAgentId || 'ceo-001';
            } else {
              managerId = 'ceo-001'; // Default fallback
            }
          }

          // Verify manager exists
          if (!managerId) {
            console.log(error('❌ Manager ID is required'));
            process.exit(1);
          }
          const manager = getAgent(db, managerId);
          if (!manager) {
            console.log(error(`❌ Manager agent not found: ${managerId}`));
            process.exit(1);
          }

          console.log(info(`Manager: ${manager.display_name} (${manager.role})`));
          console.log();

          // Interactive prompts for missing fields
          const role =
            options.role || (await input('Agent role (e.g., CTO, Engineer, Designer):'));
          const displayName = options.displayName || (await input(`Display name (default: ${role}):`, role));
          const goal = options.goal || (await input('Main goal for this agent:'));

          const canHire =
            options.canHire !== undefined
              ? options.canHire
              : await confirm('Can this agent hire subordinates?', false);

          let maxSubordinates = 0;
          let hiringBudget = 0;

          if (canHire) {
            maxSubordinates =
              options.maxSubordinates !== undefined ? options.maxSubordinates : await number('Maximum subordinates:', 5);
            hiringBudget =
              options.hiringBudget !== undefined ? options.hiringBudget : await number('Hiring budget:', maxSubordinates);
          }

          const canFire =
            options.canFire !== undefined
              ? options.canFire
              : await confirm('Can this agent fire subordinates?', canHire);
          const canEscalate =
            options.canEscalate !== undefined
              ? options.canEscalate
              : await confirm('Can this agent escalate to manager?', true);

          const framework =
            options.framework ||
            (await select('Execution framework:', [
              { name: 'Claude Code (recommended)', value: 'claude-code' },
              { name: 'OpenCode', value: 'opencode' },
            ], 0));

          // Generate agent ID based on role
          const rolePrefix = role.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
          const randomSuffix = crypto.randomBytes(2).toString('hex').substring(0, 3);
          const agentId = `${rolePrefix}-${randomSuffix}`;

          // Create agent config
          const agentConfig: AgentConfig = {
            $schema: 'https://recursivemanager.dev/schemas/agent-config.schema.json',
            version: '1.0.0',
            identity: {
              id: agentId,
              role,
              displayName,
              createdAt: new Date().toISOString(),
              createdBy: managerId as string,
              reportingTo: managerId as string,
            },
            goal: {
              mainGoal: goal,
              subGoals: [],
              successCriteria: [],
            },
            permissions: {
              canHire,
              maxSubordinates,
              hiringBudget,
              canFire,
              canEscalate,
            },
            framework: {
              primary: framework as 'claude-code' | 'opencode',
              fallback: 'none',
              capabilities: [],
            },
            behavior: {
              verbosity: 3,
              maxExecutionTime: 60,
              requireApprovalForExecution: false,
              continuousMode: false,
            },
          };

          // Config path will be created by hireAgent - no need to set it in identity

          console.log();
          console.log(info('Agent Configuration:'));
          console.log(code(`  ID: ${agentId}`));
          console.log(code(`  Role: ${role}`));
          console.log(code(`  Display Name: ${displayName}`));
          console.log(code(`  Manager: ${manager.display_name}`));
          console.log(code(`  Goal: ${goal}`));
          console.log(code(`  Framework: ${framework}`));
          console.log(code(`  Can Hire: ${canHire ? 'Yes' : 'No'}`));
          if (canHire) {
            console.log(code(`  Max Subordinates: ${maxSubordinates}`));
            console.log(code(`  Hiring Budget: ${hiringBudget}`));
          }
          console.log();

          const shouldProceed = await confirm('Proceed with hiring?', true);
          if (!shouldProceed) {
            console.log(info('Hiring cancelled'));
            dbConnection.close();
            return;
          }

          const spinner = createSpinner('Hiring agent...');

          // Call hireAgent function
          const agent = await hireAgent(db, managerId as string, agentConfig, { baseDir: dataDir });

          spinner.succeed(`Agent hired successfully!`);

          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  success: true,
                  agentId: agent.id,
                  role: agent.role,
                  displayName: agent.display_name,
                  managerId: agent.reporting_to,
                },
                null,
                2
              )
            );
          } else {
            console.log();
            console.log(success('✅ Agent hired successfully!'));
            console.log();
            console.log(info('Agent Details:'));
            console.log(code(`  Agent ID: ${agent.id}`));
            console.log(code(`  Role: ${agent.role}`));
            console.log(code(`  Display Name: ${agent.display_name}`));
            console.log(code(`  Status: ${agent.status}`));
            console.log(code(`  Created: ${agent.created_at}`));
            console.log();
            console.log(info('Next Steps:'));
            console.log(code(`  - View agent: recursivemanager status --agent-id ${agent.id}`));
            console.log(
              code(`  - Debug agent: recursivemanager debug ${agent.id} --all`)
            );
            console.log(code(`  - Trigger execution: recursivemanager run ${agent.id}`));
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
