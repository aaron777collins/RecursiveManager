/**
 * Structured Logging System
 *
 * Provides Winston-based structured logging with:
 * - JSON output format for easy parsing
 * - Trace ID support for request/execution correlation
 * - Hierarchical context (agent, task, execution)
 * - Multiple log levels (error, warn, info, debug)
 * - Configurable transports (console, file)
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { randomUUID } from 'crypto';
import { getAgentLogPath } from './path-utils';

/**
 * Log level type definition
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Structured log metadata interface
 */
export interface LogMetadata {
  /** Unique trace ID for correlating related log entries */
  traceId?: string;
  /** Agent ID if log is agent-specific */
  agentId?: string;
  /** Task ID if log is task-specific */
  taskId?: string;
  /** Execution ID if log is execution-specific */
  executionId?: string;
  /** Manager/parent agent ID (hierarchical context) */
  managerId?: string;
  /** Array of subordinate agent IDs (hierarchical context) */
  subordinateIds?: string[];
  /** Full organizational path (e.g., "CEO/CTO/Backend") */
  hierarchyPath?: string;
  /** Depth/level in organizational hierarchy (0 = top level) */
  hierarchyDepth?: number;
  /** Additional custom fields */
  [key: string]: unknown;
}

/**
 * Logger interface for dependency injection and testing
 */
export interface Logger {
  error(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
  child(defaultMetadata: LogMetadata): Logger;
}

/**
 * Winston logger configuration options
 */
export interface LoggerOptions {
  /** Log level threshold (default: 'info') */
  level?: LogLevel;
  /** Enable console output (default: true) */
  console?: boolean;
  /** Enable file output (default: false) */
  file?: boolean;
  /** File path for log output (required if file: true) */
  filePath?: string;
  /** Enable JSON format (default: true) */
  json?: boolean;
  /** Default metadata to include in all logs */
  defaultMetadata?: LogMetadata;
  /** Enable log rotation (default: false, requires file: true) */
  rotation?: boolean;
  /** Date pattern for rotation (default: 'YYYY-MM-DD') */
  datePattern?: string;
  /** Enable compression of rotated logs (default: true when rotation enabled) */
  compress?: boolean;
  /** Maximum number of days to retain logs (default: 30) */
  maxFiles?: number | string;
  /** Maximum size of each log file (e.g., '20m', '100k') */
  maxSize?: string;
}

/**
 * Winston-based logger implementation
 */
class WinstonLogger implements Logger {
  private logger: winston.Logger;
  private defaultMetadata: LogMetadata;
  private options: LoggerOptions;

  constructor(options: LoggerOptions = {}) {
    const {
      level = 'info',
      console: enableConsole = true,
      file: enableFile = false,
      filePath,
      json = true,
      defaultMetadata = {},
      rotation = false,
      datePattern = 'YYYY-MM-DD',
      compress = true,
      maxFiles = '30d',
      maxSize,
    } = options;

    // Validate file options
    if (enableFile && !filePath) {
      throw new Error('filePath is required when file output is enabled');
    }

    // Validate rotation options
    if (rotation && !enableFile) {
      throw new Error('rotation requires file output to be enabled');
    }

    this.defaultMetadata = defaultMetadata;
    this.options = options;

    // Configure transports
    const transports: winston.transport[] = [];

    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: json
            ? winston.format.json()
            : winston.format.combine(winston.format.colorize(), winston.format.simple()),
        })
      );
    }

    if (enableFile && filePath) {
      if (rotation) {
        // Use daily rotate file transport for rotation support
        transports.push(
          new DailyRotateFile({
            filename: filePath.replace(/\.log$/, '-%DATE%.log'),
            datePattern,
            zippedArchive: compress,
            maxFiles,
            maxSize,
            format: winston.format.json(),
          })
        );
      } else {
        // Use standard file transport for non-rotated logs
        transports.push(
          new winston.transports.File({
            filename: filePath,
            format: winston.format.json(),
          })
        );
      }
    }

    // Create Winston logger instance
    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS',
        }),
        winston.format.errors({ stack: true }),
        winston.format.metadata({
          fillExcept: ['message', 'level', 'timestamp'],
        }),
        winston.format.json()
      ),
      transports,
      // Prevent Winston from exiting on error
      exitOnError: false,
    });
  }

  /**
   * Merge metadata with defaults
   */
  private mergeMetadata(metadata?: LogMetadata): LogMetadata {
    return {
      ...this.defaultMetadata,
      ...metadata,
    };
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: LogMetadata): void {
    this.logger.error(message, this.mergeMetadata(metadata));
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(message, this.mergeMetadata(metadata));
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(message, this.mergeMetadata(metadata));
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(message, this.mergeMetadata(metadata));
  }

  /**
   * Create child logger with default metadata
   *
   * @param defaultMetadata - Metadata to include in all logs from this child
   * @returns New logger instance with merged default metadata
   *
   * @example
   * ```typescript
   * const agentLogger = logger.child({ agentId: 'agent-123' });
   * agentLogger.info('Task started', { taskId: 'task-456' });
   * // Results in log with both agentId and taskId
   * ```
   */
  child(defaultMetadata: LogMetadata): Logger {
    return new WinstonLogger({
      ...this.options,
      level: this.logger.level as LogLevel,
      defaultMetadata: {
        ...this.defaultMetadata,
        ...defaultMetadata,
      },
    });
  }

  /**
   * Get underlying Winston logger (for testing/advanced use)
   */
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}

/**
 * Generate a new trace ID for correlation
 *
 * @returns UUID v4 string
 *
 * @example
 * ```typescript
 * const traceId = generateTraceId();
 * logger.info('Request started', { traceId });
 * // ... do work ...
 * logger.info('Request completed', { traceId });
 * ```
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Create a new logger instance
 *
 * @param options - Logger configuration options
 * @returns Configured logger instance
 *
 * @example
 * ```typescript
 * // Basic console logger
 * const logger = createLogger();
 *
 * // Debug level with file output
 * const debugLogger = createLogger({
 *   level: 'debug',
 *   file: true,
 *   filePath: '/var/log/app.log'
 * });
 *
 * // Agent-specific logger
 * const agentLogger = createLogger({
 *   defaultMetadata: { agentId: 'agent-123' }
 * });
 * ```
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new WinstonLogger(options);
}

/**
 * Create an agent-specific logger instance
 *
 * Creates a logger configured for per-agent log files with:
 * - Agent ID in default metadata
 * - File output to logs/agents/{agentId}.log
 * - Log rotation enabled (daily)
 * - Console output disabled by default (agent logs go to files)
 *
 * @param agentId - Unique agent identifier
 * @param options - Additional logger options to override defaults
 * @returns Configured logger instance for the agent
 *
 * @example
 * ```typescript
 * // Create logger for CEO agent
 * const ceoLogger = createAgentLogger('CEO');
 * ceoLogger.info('Task started', { taskId: 'task-123' });
 * // Logs to: ~/.recursive-manager/logs/agents/CEO.log
 *
 * // Create with debug level and console output
 * const debugAgentLogger = createAgentLogger('DevOps', {
 *   level: 'debug',
 *   console: true
 * });
 * ```
 */
export function createAgentLogger(agentId: string, options?: Partial<LoggerOptions>): Logger {
  if (!agentId || agentId.trim() === '') {
    throw new Error('agentId is required and cannot be empty');
  }

  const agentLogPath = getAgentLogPath(agentId);

  return createLogger({
    level: 'info',
    console: false, // Agent logs go to files by default
    file: true,
    filePath: agentLogPath,
    rotation: true, // Enable rotation for production reliability
    json: true,
    defaultMetadata: {
      agentId,
    },
    ...options, // Allow overriding defaults
  });
}

/**
 * Agent hierarchy context for logging
 */
export interface AgentHierarchyContext {
  /** Manager/parent agent ID */
  managerId: string | null;
  /** Array of subordinate agent IDs */
  subordinateIds: string[];
  /** Full organizational path (e.g., "CEO/CTO/Backend") */
  hierarchyPath: string;
  /** Depth/level in organizational hierarchy (0 = top level) */
  hierarchyDepth: number;
}

/**
 * Get agent hierarchy context from the database
 *
 * This function retrieves hierarchical information about an agent including:
 * - Manager ID (reporting_to)
 * - Subordinate IDs (agents reporting to this agent)
 * - Hierarchy path (organizational path from root)
 * - Hierarchy depth (level in organization, 0 = top)
 *
 * @param db - Database instance (better-sqlite3)
 * @param agentId - Agent ID to get hierarchy for
 * @returns Agent hierarchy context or null if agent not found
 *
 * @example
 * ```typescript
 * import Database from 'better-sqlite3';
 * const db = new Database('app.db');
 * const hierarchy = getAgentHierarchyContext(db, 'backend-dev-001');
 * // Returns: {
 * //   managerId: 'cto-001',
 * //   subordinateIds: [],
 * //   hierarchyPath: 'CEO/CTO/Backend Dev',
 * //   hierarchyDepth: 2
 * // }
 * ```
 */
export function getAgentHierarchyContext(
  db: any, // Use 'any' to avoid circular dependency with db package
  agentId: string
): AgentHierarchyContext | null {
  try {
    // Get agent info (including manager ID)
    const agentQuery = db.prepare(`
      SELECT reporting_to
      FROM agents
      WHERE id = ?
    `);
    const agent = agentQuery.get(agentId);

    if (!agent) {
      return null;
    }

    // Get subordinates
    const subordinatesQuery = db.prepare(`
      SELECT id
      FROM agents
      WHERE reporting_to = ?
    `);
    const subordinates = subordinatesQuery.all(agentId);
    const subordinateIds = subordinates.map((s: any) => s.id);

    // Get hierarchy path and depth from org_hierarchy table
    // We want the entry where agent_id = agentId and ancestor_id = root
    // The root is the entry with maximum depth (furthest ancestor)
    const hierarchyQuery = db.prepare(`
      SELECT path, depth
      FROM org_hierarchy
      WHERE agent_id = ?
      ORDER BY depth DESC
      LIMIT 1
    `);
    const hierarchy = hierarchyQuery.get(agentId);

    return {
      managerId: agent.reporting_to,
      subordinateIds,
      hierarchyPath: hierarchy?.path || agentId,
      hierarchyDepth: hierarchy?.depth || 0,
    };
  } catch (error) {
    // If database query fails, return null rather than throwing
    // This allows logging to continue even if hierarchy lookup fails
    return null;
  }
}

/**
 * Create an agent logger with hierarchical context
 *
 * This function creates a logger for an agent that includes organizational
 * hierarchy information in its default metadata. This allows logs to include
 * manager, subordinate, and path information automatically.
 *
 * Features:
 * - Includes manager ID in all logs
 * - Includes subordinate IDs in all logs
 * - Includes full organizational path (e.g., "CEO/CTO/Backend")
 * - Includes hierarchy depth/level
 * - Per-agent log files in logs/agents/
 * - Log rotation enabled (daily)
 *
 * @param db - Database instance for querying hierarchy
 * @param agentId - Unique agent identifier
 * @param options - Additional logger options to override defaults
 * @returns Configured logger with hierarchical context
 *
 * @example
 * ```typescript
 * import Database from 'better-sqlite3';
 * const db = new Database('app.db');
 *
 * // Create hierarchical logger for backend dev
 * const logger = createHierarchicalAgentLogger(db, 'backend-dev-001');
 * logger.info('Processing task');
 * // Log includes: agentId, managerId, subordinateIds, hierarchyPath, hierarchyDepth
 *
 * // If hierarchy lookup fails, falls back to basic agent logger
 * const logger2 = createHierarchicalAgentLogger(db, 'unknown-agent');
 * logger2.info('Still works'); // Just missing hierarchy fields
 * ```
 */
export function createHierarchicalAgentLogger(
  db: any, // Use 'any' to avoid circular dependency
  agentId: string,
  options?: Partial<LoggerOptions>
): Logger {
  if (!agentId || agentId.trim() === '') {
    throw new Error('agentId is required and cannot be empty');
  }

  // Get hierarchy context
  const hierarchy = getAgentHierarchyContext(db, agentId);

  // Build default metadata with hierarchy if available
  const defaultMetadata: LogMetadata = {
    agentId,
  };

  if (hierarchy) {
    if (hierarchy.managerId) {
      defaultMetadata.managerId = hierarchy.managerId;
    }
    if (hierarchy.subordinateIds.length > 0) {
      defaultMetadata.subordinateIds = hierarchy.subordinateIds;
    }
    defaultMetadata.hierarchyPath = hierarchy.hierarchyPath;
    defaultMetadata.hierarchyDepth = hierarchy.hierarchyDepth;
  }

  const agentLogPath = getAgentLogPath(agentId);

  return createLogger({
    level: 'info',
    console: false, // Agent logs go to files by default
    file: true,
    filePath: agentLogPath,
    rotation: true,
    json: true,
    defaultMetadata,
    ...options, // Allow overriding defaults
  });
}

/**
 * Default application logger instance
 *
 * Pre-configured with:
 * - Info level
 * - JSON format
 * - Console output
 *
 * @example
 * ```typescript
 * import { logger } from '@recursive-manager/common';
 *
 * logger.info('Application started');
 * logger.error('Database connection failed', { error: err.message });
 * ```
 */
export const logger = createLogger({
  level: 'info',
  json: true,
  console: true,
});
