/**
 * Debug command - Debug a specific agent
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { header, error, info, code, subheader, warning } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { loadConfig } from '../utils/config';
import {
  initializeDatabase,
  getAgent,
  getActiveTasks,
  getAgentLogPath,
} from '@recursive-manager/common';

export function registerDebugCommand(program: Command): void {
  program
    .command('debug <agent-id>')
    .description('Debug a specific agent')
    .option('--logs <n>', 'Show last N lines of agent logs (default: 50)', '50')
    .option('--state', 'Show agent state')
    .option('--tasks', 'Show agent tasks')
    .option('--all', 'Show all debug information')
    .option('--json', 'Output as JSON')
    .option('--data-dir <dir>', 'Custom data directory')
    .action(
      async (
        agentId: string,
        options: {
          logs?: string;
          state?: boolean;
          tasks?: boolean;
          all?: boolean;
          json?: boolean;
          dataDir?: string;
        }
      ) => {
        try {
          const config = loadConfig(options.dataDir);
          const dbConnection = initializeDatabase({ path: config.dbPath });

          try {
            const spinner = options.json
              ? null
              : createSpinner('Loading agent debug information...');

            // Load agent from database
            const agent = getAgent(dbConnection.db, agentId);
            if (!agent) {
              if (spinner) spinner.fail('Agent not found');
              console.error(error(`Agent '${agentId}' not found`));
              console.log();
              console.log(warning('Use ' + code('status') + ' to list all agents'));
              console.log();
              process.exit(1);
            }

            // Load tasks for this agent
            const tasks = getActiveTasks(dbConnection.db, agentId);

            // Read logs if requested
            let logs: string[] = [];
            const logPath = getAgentLogPath(agentId, { baseDir: config.dataDir });
            if (existsSync(logPath)) {
              const logContent = readFileSync(logPath, 'utf-8');
              const allLines = logContent.split('\n').filter((line) => line.trim());
              const logLimit = parseInt(options.logs || '50', 10);
              logs = allLines.slice(-logLimit);
            }

            if (spinner) spinner.succeed('Debug information loaded');

            // Output based on format
            if (options.json) {
              const output = {
                agent: {
                  id: agent.id,
                  role: agent.role,
                  displayName: agent.display_name,
                  status: agent.status,
                  reportingTo: agent.reporting_to,
                  createdAt: agent.created_at,
                  createdBy: agent.created_by,
                  mainGoal: agent.main_goal,
                  configPath: agent.config_path,
                  lastExecutionAt: agent.last_execution_at,
                  totalExecutions: agent.total_executions,
                  totalRuntimeMinutes: agent.total_runtime_minutes,
                },
                tasks: tasks.map((t: any) => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  createdAt: t.created_at,
                  assignedTo: t.assigned_to,
                  parentTaskId: t.parent_task_id,
                  blockedBy: t.blocked_by,
                  progressPercent: t.progress_percent,
                })),
                logs,
                logPath,
              };
              console.log(JSON.stringify(output, null, 2));
            } else {
              console.log();
              console.log(header('\n🔍 Agent Debug Information'));
              console.log();
              console.log(info('Agent ID: ') + code(agentId));
              console.log();

              const showAll = options.all || (!options.logs && !options.state && !options.tasks);

              if (showAll || options.state) {
                console.log(subheader('Agent State:'));
                console.log();
                console.log('Display Name:', code(agent.display_name));
                console.log('Role:', code(agent.role));
                console.log('Status:', code(agent.status));
                console.log(
                  'Reporting To:',
                  code(agent.reporting_to ? agent.reporting_to : 'None (root)')
                );
                console.log('Created:', code(agent.created_at));
                console.log('Created By:', code(agent.created_by || 'system'));
                console.log('Main Goal:', code(agent.main_goal || 'N/A'));
                console.log('Config Path:', code(agent.config_path));
                if (agent.last_execution_at) {
                  console.log('Last Execution:', code(agent.last_execution_at));
                }
                console.log('Total Executions:', code(agent.total_executions.toString()));
                console.log(
                  'Total Runtime:',
                  code(agent.total_runtime_minutes.toFixed(2) + ' minutes')
                );
                console.log();
              }

              if (showAll || options.tasks) {
                console.log(subheader('Agent Tasks:'));
                console.log();
                if (tasks.length === 0) {
                  console.log(info('  No active tasks'));
                } else {
                  const statusEmoji: Record<string, string> = {
                    pending: '○',
                    in_progress: '⏳',
                    completed: '✓',
                    blocked: '🚫',
                    failed: '✗',
                  };
                  tasks.forEach((task: any) => {
                    const emoji = statusEmoji[task.status] || '?';
                    const blockedInfo = task.blocked_by ? ` (blocked by ${task.blocked_by})` : '';
                    const progress =
                      task.progress_percent !== null ? ` - ${task.progress_percent}%` : '';
                    console.log(
                      `  ${emoji} ${code(task.id)} - ${task.title} [${task.status}]${progress}${blockedInfo}`
                    );
                  });
                }
                console.log();
                const pending = tasks.filter((t: any) => t.status === 'pending').length;
                const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
                const completed = tasks.filter((t: any) => t.status === 'completed').length;
                const blocked = tasks.filter((t: any) => t.status === 'blocked').length;
                console.log(
                  info('Total: ') +
                    code(
                      `${tasks.length} tasks (${completed} completed, ${inProgress} in progress, ${pending} pending, ${blocked} blocked)`
                    )
                );
                console.log();
              }

              if (showAll || options.logs) {
                console.log(subheader('Recent Logs:'));
                console.log();
                if (logs.length === 0) {
                  console.log(info('  No logs found'));
                } else {
                  logs.forEach((line) => {
                    console.log('  ' + line);
                  });
                }
                console.log();
                console.log(info('Full logs at: ') + code(logPath));
                console.log();
              }

              if (!options.all && !options.logs && !options.state && !options.tasks) {
                console.log(
                  info(
                    'Use ' +
                      code('--logs') +
                      ', ' +
                      code('--state') +
                      ', or ' +
                      code('--tasks') +
                      ' to filter debug information'
                  )
                );
                console.log();
              }
            }
          } finally {
            dbConnection.close();
          }
        } catch (err) {
          console.error(error('Debug failed: ' + (err as Error).message));
          console.log();
          console.log(warning('Make sure the agent ID is valid and the agent exists'));
          console.log();
          process.exit(1);
        }
      }
    );
}
