/**
 * RecursiveManager Global Configuration
 *
 * This module handles loading global configuration from environment variables
 * for the RecursiveManager system. It loads from multiple sources:
 * 1. ~/.recursivemanager/.env (if exists)
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

  // AI Provider Configuration
  /** AI provider to use for multi-perspective analysis */
  aiProvider: string;

  /** Fallback AI provider if primary is unavailable */
  aiFallbackProvider?: string;

  // AICEO Gateway Configuration
  /** AICEO Gateway API endpoint */
  aiceoGatewayUrl?: string;

  /** AICEO Gateway API key for authentication */
  aiceoGatewayApiKey?: string;

  /** Provider for AICEO Gateway to use (glm, anthropic, openai, custom) */
  aiceoGatewayProvider?: string;

  /** Model for AICEO Gateway to use */
  aiceoGatewayModel?: string;

  /** Request priority for AICEO Gateway (high, normal, low) */
  aiceoGatewayPriority?: string;

  /** Custom endpoint URL (when using provider=custom) */
  aiceoGatewayCustomEndpoint?: string;

  /** Custom endpoint API key (when using provider=custom) */
  aiceoGatewayCustomApiKey?: string;

  // Direct Anthropic Configuration
  /** Anthropic API key */
  anthropicApiKey?: string;

  /** Anthropic API endpoint */
  anthropicApiUrl?: string;

  /** Anthropic model to use */
  anthropicModel?: string;

  // Direct OpenAI Configuration
  /** OpenAI API key */
  openaiApiKey?: string;

  /** OpenAI API endpoint */
  openaiApiUrl?: string;

  /** OpenAI model to use */
  openaiModel?: string;

  // Custom Provider Configuration
  /** Custom provider endpoint URL */
  customProviderUrl?: string;

  /** Custom provider API key */
  customProviderApiKey?: string;

  /** Custom provider request format (openai, anthropic, custom) */
  customProviderFormat?: string;

  // Analysis Configuration
  /** Cache TTL for analysis results in milliseconds */
  analysisCacheTtlMs?: number;
}

/**
 * Load configuration from environment variables and .env files
 *
 * Loading priority (later sources override earlier ones):
 * 1. Default values
 * 2. ~/.recursivemanager/.env
 * 3. Current directory .env
 * 4. Process environment variables
 *
 * @returns RecursiveManagerConfig object with all configuration values
 *
 * @example
 * ```typescript
 * const config = loadConfig();
 * console.log(config.home); // ~/.recursivemanager
 * console.log(config.maxAgentDepth); // 5
 * ```
 */
export function loadConfig(): RecursiveManagerConfig {
  // Load .env from home directory if exists
  const envPath = path.join(os.homedir(), '.recursivemanager', '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  // Load from current directory (will override home directory values)
  dotenv.config();

  // Resolve home directory with default
  const home = process.env.RECURSIVEMANAGER_HOME || path.join(os.homedir(), '.recursivemanager');

  // Build configuration object with defaults
  return {
    home,
    dataDir: process.env.RECURSIVEMANAGER_DATA_DIR || path.join(home, 'data'),
    logLevel: (process.env.LOG_LEVEL as RecursiveManagerConfig['logLevel']) || 'info',
    logFile: process.env.LOG_FILE || path.join(home, 'logs', 'recursivemanager.log'),
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

    // AI Provider Configuration
    aiProvider: process.env.AI_PROVIDER || 'aiceo-gateway',
    aiFallbackProvider: process.env.AI_FALLBACK_PROVIDER,

    // AICEO Gateway Configuration
    aiceoGatewayUrl: process.env.AICEO_GATEWAY_URL || 'http://localhost:4000/api/glm/submit',
    aiceoGatewayApiKey: process.env.AICEO_GATEWAY_API_KEY,
    aiceoGatewayProvider: process.env.AICEO_GATEWAY_PROVIDER || 'glm',
    aiceoGatewayModel: process.env.AICEO_GATEWAY_MODEL || 'glm-4.7',
    aiceoGatewayPriority: process.env.AICEO_GATEWAY_PRIORITY || 'high',
    aiceoGatewayCustomEndpoint: process.env.AICEO_GATEWAY_CUSTOM_ENDPOINT,
    aiceoGatewayCustomApiKey: process.env.AICEO_GATEWAY_CUSTOM_API_KEY,

    // Direct Anthropic Configuration
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicApiUrl: process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',

    // Direct OpenAI Configuration
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiApiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo',

    // Custom Provider Configuration
    customProviderUrl: process.env.CUSTOM_PROVIDER_URL,
    customProviderApiKey: process.env.CUSTOM_PROVIDER_API_KEY,
    customProviderFormat: process.env.CUSTOM_PROVIDER_FORMAT,

    // Analysis Configuration
    analysisCacheTtlMs: parseInt(process.env.ANALYSIS_CACHE_TTL_MS || '3600000', 10),
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
 * import { config } from '@recursivemanager/common';
 *
 * console.log(`RecursiveManager home: ${config.home}`);
 * console.log(`Max agent depth: ${config.maxAgentDepth}`);
 * ```
 */
export const config = loadConfig();
