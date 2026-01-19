/**
 * Configuration utilities for RecursiveManager CLI
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { error } from './colors';

/**
 * Configuration structure for RecursiveManager
 */
export interface Config {
  dataDir: string;
  dbPath: string;
  rootAgentId: string;
  version: string;
  execution: {
    workerPoolSize: number;
    maxConcurrentTasks: number;
  };
}

/**
 * Load RecursiveManager configuration
 * @param dataDir - Optional custom data directory
 * @returns Configuration object
 * @throws Exits process if not initialized or configuration is invalid
 */
export function loadConfig(dataDir?: string): Config {
  const configDir =
    dataDir || process.env.RECURSIVE_MANAGER_DATA_DIR || resolve(process.cwd(), '.recursive-manager');
  const markerFile = resolve(configDir, '.recursive-manager');

  // Check if RecursiveManager is initialized
  if (!existsSync(markerFile)) {
    console.error(error('RecursiveManager not initialized! Run: recursive-manager init "<goal>"'));
    process.exit(1);
  }

  // Check if config.json exists
  const configPath = resolve(configDir, 'config.json');
  if (!existsSync(configPath)) {
    console.error(error('Configuration not found! Data directory may be corrupted.'));
    process.exit(1);
  }

  // Load and parse configuration
  let config: Config;
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configContent);
  } catch (err) {
    console.error(error('Failed to parse configuration: ' + (err as Error).message));
    process.exit(1);
  }

  // Validate database exists
  if (!existsSync(config.dbPath)) {
    console.error(error(`Database not found at ${config.dbPath}`));
    process.exit(1);
  }

  return config;
}
