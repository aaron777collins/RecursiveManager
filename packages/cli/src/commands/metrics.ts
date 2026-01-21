/**
 * Metrics command - Start Prometheus metrics HTTP server
 */

import { Command } from 'commander';
import { startMetricsServer } from '@recursivemanager/core';
import chalk from 'chalk';

export function createMetricsCommand(): Command {
  const command = new Command('metrics');

  command
    .description('Start Prometheus metrics HTTP server')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
    .action(async (options) => {
      try {
        const port = parseInt(options.port, 10);

        if (isNaN(port) || port < 1 || port > 65535) {
          console.error(chalk.red('Error: Port must be a number between 1 and 65535'));
          process.exit(1);
        }

        console.log(chalk.blue('Starting metrics server...'));
        console.log(chalk.gray(`Host: ${options.host}`));
        console.log(chalk.gray(`Port: ${port}`));
        console.log();

        const server = await startMetricsServer({
          port,
          host: options.host,
        });

        console.log();
        console.log(chalk.green('✓ Metrics server started successfully!'));
        console.log();
        console.log(chalk.bold('Available endpoints:'));
        console.log(chalk.cyan(`  • Health check: http://${options.host}:${port}/health`));
        console.log(chalk.cyan(`  • Metrics:      http://${options.host}:${port}/metrics`));
        console.log();
        console.log(chalk.yellow('Press Ctrl+C to stop the server'));

        // Handle graceful shutdown
        const shutdown = async (signal: string) => {
          console.log();
          console.log(chalk.yellow(`\nReceived ${signal}, shutting down gracefully...`));
          try {
            await server.stop();
            console.log(chalk.green('✓ Server stopped'));
            process.exit(0);
          } catch (error) {
            console.error(chalk.red('Error stopping server:'), error);
            process.exit(1);
          }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        // Keep process alive
        await new Promise(() => {});
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red('Failed to start metrics server:'), error.message);
          if (error.message.includes('already in use')) {
            console.log();
            console.log(chalk.yellow('Suggestions:'));
            console.log(chalk.gray('  • Use a different port with --port <port>'));
            console.log(chalk.gray('  • Stop the process using the port'));
            console.log(chalk.gray(`  • Check running processes: lsof -i :${options.port}`));
          }
        } else {
          console.error(chalk.red('Failed to start metrics server:'), error);
        }
        process.exit(1);
      }
    });

  return command;
}
