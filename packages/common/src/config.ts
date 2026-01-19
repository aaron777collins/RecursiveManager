/**
 * RecursiveManager Global Configuration
 *
 * This module handles loading global configuration from environment variables
 * for the RecursiveManager system. It loads from multiple sources:
 * 1. ~/.recursive-manager/.env (if exists)
 * 2. Current directory .env file
 * 3. Environment variables
 *
 * The configuration includes installation paths, logging, agent limits,
 * execution settings, and framework adapter configuration.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import dotenv from 'dotenv';

/**
 * Global configuration interface for RecursiveManager
 */
export interface RecursiveManagerConfig {
  /** Installation home directory */
  home: string;

  /** Data storage directory */
  dataDir: string;

  /** Logging level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /** Log file path */
  logFile: string;

  /** Maximum depth of agent hierarchy */
  maxAgentDepth: number;

  /** Maximum number of agents per manager */
  maxAgentsPerManager: number;

  /** Agent execution timeout in milliseconds */
  agentTimeoutMs: number;

  /** Worker pool size for concurrent execution */
  workerPoolSize: number;

  /** Interval for continuous execution mode in milliseconds */
  continuousExecutionIntervalMs: number;

  /** Default framework adapter to use */
  defaultFramework: string;

  /** Path to Claude Code executable */
  claudeCodePath: string;
}

/**
 * Load configuration from environment variables and .env files
 *
 * Loading priority (later sources override earlier ones):
 * 1. Default values
 * 2. ~/.recursive-manager/.env
 * 3. Current directory .env
 * 4. Process environment variables
 *
 * @returns RecursiveManagerConfig object with all configuration values
 *
 * @example
 * ```typescript
 * const config = loadConfig();
 * console.log(config.home); // ~/.recursive-manager
 * console.log(config.maxAgentDepth); // 5
 * ```
 */
export function loadConfig(): RecursiveManagerConfig {
  // Load .env from home directory if exists
  const envPath = path.join(os.homedir(), '.recursive-manager', '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  // Load from current directory (will override home directory values)
  dotenv.config();

  // Resolve home directory with default
  const home = process.env.RECURSIVE_MANAGER_HOME || path.join(os.homedir(), '.recursive-manager');

  // Build configuration object with defaults
  return {
    home,
    dataDir: process.env.RECURSIVE_MANAGER_DATA_DIR || path.join(home, 'data'),
    logLevel: (process.env.LOG_LEVEL as RecursiveManagerConfig['logLevel']) || 'info',
    logFile: process.env.LOG_FILE || path.join(home, 'logs', 'recursive-manager.log'),
    maxAgentDepth: parseInt(process.env.MAX_AGENT_DEPTH || '5', 10),
    maxAgentsPerManager: parseInt(process.env.MAX_AGENTS_PER_MANAGER || '10', 10),
    agentTimeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '300000', 10),
    workerPoolSize: parseInt(process.env.WORKER_POOL_SIZE || '5', 10),
    continuousExecutionIntervalMs: parseInt(
      process.env.CONTINUOUS_EXECUTION_INTERVAL_MS || '5000',
      10
    ),
    defaultFramework: process.env.DEFAULT_FRAMEWORK || 'claude-code',
    claudeCodePath: process.env.CLAUDE_CODE_PATH || 'claude',
  };
}

/**
 * Global configuration instance
 *
 * This is loaded once when the module is imported and can be used
 * throughout the application.
 *
 * @example
 * ```typescript
 * import { config } from '@recursive-manager/common';
 *
 * console.log(`RecursiveManager home: ${config.home}`);
 * console.log(`Max agent depth: ${config.maxAgentDepth}`);
 * ```
 */
export const config = loadConfig();
