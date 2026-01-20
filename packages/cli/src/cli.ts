#!/usr/bin/env node

/**
 * RecursiveManager CLI Entry Point
 *
 * Main executable for the recursive-manager command-line tool.
 */

import { Command } from 'commander';
import { VERSION } from './index';
import { registerInitCommand } from './commands/init';
import { registerStatusCommand } from './commands/status';
import { registerUpdateCommand } from './commands/update';
import { registerConfigCommand } from './commands/config';
import { registerDebugCommand } from './commands/debug';
import { registerRollbackCommand } from './commands/rollback';
import { registerAnalyzeCommand } from './commands/analyze';
import { registerHireCommand } from './commands/hire';
import { registerFireCommand } from './commands/fire';
import { registerMessageCommand } from './commands/message';
import { registerRunCommand } from './commands/run';
import { registerLogsCommand } from './commands/logs';

const program = new Command();

program
  .name('recursive-manager')
  .description('Hierarchical AI agent system for autonomous task management')
  .version(VERSION);

// Register all commands
registerInitCommand(program);
registerStatusCommand(program);
registerUpdateCommand(program);
registerConfigCommand(program);
registerDebugCommand(program);
registerRollbackCommand(program);
registerAnalyzeCommand(program);
registerHireCommand(program);
registerFireCommand(program);
registerMessageCommand(program);
registerRunCommand(program);
registerLogsCommand(program);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
