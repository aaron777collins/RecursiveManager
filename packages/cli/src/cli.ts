#!/usr/bin/env node

/**
 * RecursiveManager CLI Entry Point
 *
 * Main executable for the recursivemanager command-line tool.
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
import { createMetricsCommand } from './commands/metrics';
import { registerHowToUseCommand } from './commands/how-to-use-command';
import { registerHowToUseExtendedCommand } from './commands/how-to-use-extended-command';

const program = new Command();

program
  .name('recursivemanager')
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
registerHowToUseCommand(program);
registerHowToUseExtendedCommand(program);
program.addCommand(createMetricsCommand());

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  console.log(`
RecursiveManager v${VERSION} - AI-Powered Development Manager
================================================================

Quick Start:
  recursivemanager init "your goal"          - Initialize with your goal
  recursivemanager how_to_use                - Quick start guide
  recursivemanager how_to_use_extended       - Comprehensive documentation
  recursivemanager --help                    - Show all commands

Common Commands:
  init, status, analyze, hire, fire, message, run, logs, update

For help on any command:
  recursivemanager <command> --help
  `);
}
