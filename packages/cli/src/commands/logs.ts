/**
 * Logs command - View and filter agent logs
 */

import { Command } from 'commander';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { header, error, info, code, subheader, warning, success } from '../utils/colors';
import { createSpinner } from '../utils/spinner';
import { loadConfig } from '../utils/config';
import {
  getAgentLogPath,
  getLogsDirectory,
  getAgent,
  initializeDatabase,
  type LogLevel,
} from '@recursive-manager/common';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

interface LogsOptions {
  lines?: string;
  level?: LogLevel;
  since?: string;
  until?: string;
  follow?: boolean;
  grep?: string;
  json?: boolean;
  dataDir?: string;
  all?: boolean;
}

/**
 * Parse a log line (JSONL format) into a structured LogEntry
 */
function parseLogLine(line: string): LogEntry | null {
  try {
    const parsed = JSON.parse(line);
    return {
      timestamp: parsed.timestamp || '',
      level: parsed.level || 'info',
      message: parsed.message || '',
      metadata: parsed.metadata || {},
    };
  } catch {
    // Fallback for non-JSON lines (legacy logs)
    return {
      timestamp: '',
      level: 'info',
      message: line,
      metadata: {},
    };
  }
}

/**
 * Filter log entries based on criteria
 */
function filterLogEntry(entry: LogEntry, options: LogsOptions): boolean {
  // Filter by log level
  if (options.level) {
    const levelOrder: Record<LogLevel, number> = {
      error: 3,
      warn: 2,
      info: 1,
      debug: 0,
    };
    const entryLevel = levelOrder[entry.level] || 0;
    const filterLevel = levelOrder[options.level] || 0;
    if (entryLevel < filterLevel) {
      return false;
    }
  }

  // Filter by time range
  if (options.since && entry.timestamp) {
    if (entry.timestamp < options.since) {
      return false;
    }
  }
  if (options.until && entry.timestamp) {
    if (entry.timestamp > options.until) {
      return false;
    }
  }

  // Filter by grep pattern
  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    const searchText = `${entry.message} ${JSON.stringify(entry.metadata)}`;
    if (!pattern.test(searchText)) {
      return false;
    }
  }

  return true;
}

/**
 * Format a log entry for display
 */
function formatLogEntry(entry: LogEntry, colorize: boolean): string {
  const levelColors: Record<LogLevel, (s: string) => string> = {
    error: error,
    warn: warning,
    info: info,
    debug: (s) => s,
  };

  const levelColor = colorize ? levelColors[entry.level] || info : (s: string) => s;
  const timeColor = colorize ? code : (s: string) => s;

  const timestamp = entry.timestamp ? `[${timeColor(entry.timestamp)}]` : '';
  const level = `[${levelColor(entry.level.toUpperCase())}]`;
  const message = entry.message;

  let formatted = `${timestamp} ${level} ${message}`;

  // Add metadata if present and non-empty
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    const metadataStr = JSON.stringify(entry.metadata);
    formatted += ` ${colorize ? code(metadataStr) : metadataStr}`;
  }

  return formatted;
}

/**
 * Get all agent IDs from the logs directory
 */
function getAllAgentIds(logsDir: string): string[] {
  const agentsDir = join(logsDir, 'agents');
  if (!existsSync(agentsDir)) {
    return [];
  }

  return readdirSync(agentsDir)
    .filter((file) => file.endsWith('.log'))
    .map((file) => file.replace('.log', ''));
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs [agent-id]')
    .description('View and filter agent logs')
    .option('-n, --lines <n>', 'Show last N lines (default: 50, use 0 for all)', '50')
    .option('-l, --level <level>', 'Filter by log level (debug|info|warn|error)')
    .option('--since <time>', 'Show logs since timestamp (YYYY-MM-DD HH:mm:ss)')
    .option('--until <time>', 'Show logs until timestamp (YYYY-MM-DD HH:mm:ss)')
    .option('-f, --follow', 'Follow log output (tail -f mode)', false)
    .option('-g, --grep <pattern>', 'Filter logs by pattern (case-insensitive regex)')
    .option('--all', 'Show logs from all agents', false)
    .option('--json', 'Output as JSON', false)
    .option('--data-dir <dir>', 'Custom data directory')
    .action(async (agentId: string | undefined, options: LogsOptions) => {
      try {
        const config = loadConfig(options.dataDir);
        const logsDir = getLogsDirectory({ baseDir: config.dataDir });

        // Validate level option
        if (options.level) {
          const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
          if (!validLevels.includes(options.level)) {
            console.error(error(`Invalid log level: ${options.level}`));
            console.log();
            console.log(info('Valid levels: ') + code('error, warn, info, debug'));
            console.log();
            process.exit(1);
          }
        }

        // Handle --all flag or missing agentId
        if (options.all || !agentId) {
          const allAgentIds = getAllAgentIds(logsDir);
          if (allAgentIds.length === 0) {
            console.error(error('No agent logs found'));
            console.log();
            console.log(warning('Agents will create logs when they execute'));
            console.log();
            process.exit(1);
          }

          if (!options.json) {
            console.log();
            console.log(header('📋 Agent Logs Summary'));
            console.log();
            console.log(info(`Found logs for ${allAgentIds.length} agent(s)`));
            console.log();
          }

          // Show logs from all agents
          const allEntries: Array<LogEntry & { agentId: string }> = [];

          for (const currentAgentId of allAgentIds) {
            const logPath = getAgentLogPath(currentAgentId, { baseDir: config.dataDir });
            if (existsSync(logPath)) {
              const logContent = readFileSync(logPath, 'utf-8');
              const lines = logContent.split('\n').filter((line) => line.trim());

              for (const line of lines) {
                const entry = parseLogLine(line);
                if (entry && filterLogEntry(entry, options)) {
                  allEntries.push({ ...entry, agentId: currentAgentId });
                }
              }
            }
          }

          // Sort by timestamp
          allEntries.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

          // Apply line limit
          const lineLimit = parseInt(options.lines || '50', 10);
          const displayEntries = lineLimit === 0 ? allEntries : allEntries.slice(-lineLimit);

          // Output
          if (options.json) {
            console.log(JSON.stringify(displayEntries, null, 2));
          } else {
            for (const entry of displayEntries) {
              const agentLabel = `[${code(entry.agentId)}]`;
              console.log(`${agentLabel} ${formatLogEntry(entry, true)}`);
            }
            console.log();
            console.log(
              info(
                `Showing ${displayEntries.length} of ${allEntries.length} log entries from ${allAgentIds.length} agent(s)`
              )
            );
            console.log();
          }
          return;
        }

        // Single agent mode
        const spinner = options.json ? null : createSpinner('Loading logs...');

        // Verify agent exists
        const dbConnection = initializeDatabase({ path: config.dbPath });
        try {
          const agent = getAgent(dbConnection.db, agentId);
          if (!agent) {
            if (spinner) spinner.fail('Agent not found');
            console.error(error(`Agent '${agentId}' not found`));
            console.log();
            console.log(warning('Use ' + code('status') + ' to list all agents'));
            console.log();
            process.exit(1);
          }
        } finally {
          dbConnection.close();
        }

        // Read log file
        const logPath = getAgentLogPath(agentId, { baseDir: config.dataDir });
        if (!existsSync(logPath)) {
          if (spinner) spinner.fail('No logs found');
          console.error(error(`No log file found for agent '${agentId}'`));
          console.log();
          console.log(warning('Agent will create logs when it executes'));
          console.log();
          process.exit(1);
        }

        const logContent = readFileSync(logPath, 'utf-8');
        const allLines = logContent.split('\n').filter((line) => line.trim());

        // Parse and filter logs
        const entries: LogEntry[] = [];
        for (const line of allLines) {
          const entry = parseLogLine(line);
          if (entry && filterLogEntry(entry, options)) {
            entries.push(entry);
          }
        }

        // Apply line limit
        const lineLimit = parseInt(options.lines || '50', 10);
        const displayEntries = lineLimit === 0 ? entries : entries.slice(-lineLimit);

        if (spinner) spinner.succeed('Logs loaded');

        // Output
        if (options.json) {
          const output = {
            agentId,
            logPath,
            totalLines: allLines.length,
            filteredEntries: entries.length,
            displayedEntries: displayEntries.length,
            entries: displayEntries,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log();
          console.log(header(`📋 Logs for Agent: ${code(agentId)}`));
          console.log();

          if (displayEntries.length === 0) {
            console.log(info('  No matching log entries'));
            if (options.level || options.since || options.until || options.grep) {
              console.log();
              console.log(warning('Try removing filters to see all logs'));
            }
          } else {
            for (const entry of displayEntries) {
              console.log('  ' + formatLogEntry(entry, true));
            }
          }

          console.log();
          console.log(
            info(
              `Showing ${displayEntries.length} of ${entries.length} filtered entries (${allLines.length} total lines)`
            )
          );
          console.log();
          console.log(info('Log file: ') + code(logPath));
          console.log();

          // Show filter hints
          if (!options.level && !options.since && !options.until && !options.grep) {
            console.log(
              info(
                'Filter options: ' +
                  code('--level') +
                  ', ' +
                  code('--since') +
                  ', ' +
                  code('--until') +
                  ', ' +
                  code('--grep')
              )
            );
            console.log(
              info('View all logs: ' + code('--lines 0') + ' or all agents: ' + code('--all'))
            );
            console.log();
          }
        }

        // Follow mode (tail -f)
        if (options.follow) {
          console.log(success('Following logs... (Press Ctrl+C to stop)'));
          console.log();

          // Note: This is a simplified implementation
          // For production, consider using chokidar or tail for better performance
          let lastSize = logContent.length;
          const followInterval = setInterval(() => {
            try {
              const currentContent = readFileSync(logPath, 'utf-8');
              if (currentContent.length > lastSize) {
                const newContent = currentContent.substring(lastSize);
                const newLines = newContent.split('\n').filter((line) => line.trim());

                for (const line of newLines) {
                  const entry = parseLogLine(line);
                  if (entry && filterLogEntry(entry, options)) {
                    console.log('  ' + formatLogEntry(entry, true));
                  }
                }

                lastSize = currentContent.length;
              }
            } catch (err) {
              // File might have been rotated or deleted
              clearInterval(followInterval);
              console.log();
              console.log(warning('Log file changed or removed, stopping follow mode'));
              console.log();
            }
          }, 1000);

          // Handle graceful shutdown
          process.on('SIGINT', () => {
            clearInterval(followInterval);
            console.log();
            console.log(success('Stopped following logs'));
            console.log();
            process.exit(0);
          });
        }
      } catch (err) {
        console.error(error('Logs command failed: ' + (err as Error).message));
        console.log();
        console.log(warning('Make sure the agent ID is valid and logs exist'));
        console.log();
        process.exit(1);
      }
    });
}
