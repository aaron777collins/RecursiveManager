/**
 * Configuration utilities for RecursiveManager CLI
 */

import { existsSync, readFileSync, statSync } from 'fs';
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
    dataDir || process.env.RECURSIVEMANAGER_DATA_DIR || resolve(process.cwd(), '.recursivemanager');

  // Check if data directory exists and is a directory
  if (existsSync(configDir)) {
    try {
      const stats = statSync(configDir);
      if (!stats.isDirectory()) {
        console.error(error(`Data directory path exists but is not a directory: ${configDir}`));
        process.exit(1);
      }
    } catch (err) {
      console.error(error(`Cannot access data directory: ${(err as Error).message}`));
      process.exit(1);
    }
  }

  const markerFile = resolve(configDir, '.recursivemanager');

  // Check if RecursiveManager is initialized
  if (!existsSync(markerFile)) {
    console.error(error('RecursiveManager not initialized! Run: recursivemanager init "<goal>"'));
    process.exit(1);
  }

  // Validate marker file is a file, not a directory
  try {
    const markerStats = statSync(markerFile);
    if (!markerStats.isFile()) {
      console.error(error('Marker file exists but is not a file. Data directory may be corrupted.'));
      process.exit(1);
    }
  } catch (err) {
    console.error(error(`Cannot access marker file: ${(err as Error).message}`));
    process.exit(1);
  }

  // Validate marker file content
  try {
    const markerContent = readFileSync(markerFile, 'utf-8');
    const markerData = JSON.parse(markerContent);
    if (!markerData.initialized || !markerData.version) {
      console.error(error('Marker file is invalid. Data directory may be corrupted.'));
      process.exit(1);
    }
  } catch (err) {
    console.error(error('Failed to parse marker file. Data directory may be corrupted.'));
    process.exit(1);
  }

  // Check if config.json exists
  const configPath = resolve(configDir, 'config.json');
  if (!existsSync(configPath)) {
    console.error(error('Configuration not found! Data directory may be corrupted.'));
    process.exit(1);
  }

  // Validate config file is a file, not a directory
  try {
    const configStats = statSync(configPath);
    if (!configStats.isFile()) {
      console.error(error('Config path exists but is not a file. Data directory may be corrupted.'));
      process.exit(1);
    }
  } catch (err) {
    console.error(error(`Cannot access config file: ${(err as Error).message}`));
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

  // Validate configuration schema
  try {
    validateConfig(config);
  } catch (err) {
    console.error(error('Configuration validation failed: ' + (err as Error).message));
    process.exit(1);
  }

  // Validate database exists
  if (!existsSync(config.dbPath)) {
    console.error(error(`Database not found at ${config.dbPath}`));
    process.exit(1);
  }

  // Validate database is a file
  try {
    const dbStats = statSync(config.dbPath);
    if (!dbStats.isFile()) {
      console.error(error('Database path exists but is not a file.'));
      process.exit(1);
    }
  } catch (err) {
    console.error(error(`Cannot access database file: ${(err as Error).message}`));
    process.exit(1);
  }

  // Validate required subdirectories exist
  const requiredDirs = ['agents', 'tasks', 'logs', 'snapshots'];
  for (const dir of requiredDirs) {
    const dirPath = resolve(config.dataDir, dir);
    if (!existsSync(dirPath)) {
      console.error(error(`Required directory missing: ${dir}. Data directory may be corrupted.`));
      process.exit(1);
    }
    try {
      const dirStats = statSync(dirPath);
      if (!dirStats.isDirectory()) {
        console.error(error(`Required path ${dir} exists but is not a directory.`));
        process.exit(1);
      }
    } catch (err) {
      console.error(error(`Cannot access directory ${dir}: ${(err as Error).message}`));
      process.exit(1);
    }
  }

  return config;
}

/**
 * Get configuration file path
 * @param dataDir - Optional custom data directory
 * @returns Path to config.json
 */
export function getConfigPath(dataDir?: string): string {
  const configDir =
    dataDir || process.env.RECURSIVEMANAGER_DATA_DIR || resolve(process.cwd(), '.recursivemanager');
  return resolve(configDir, 'config.json');
}

/**
 * Get nested value from object using dot notation
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., 'execution.workerPoolSize')
 * @returns Value at path or undefined
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object using dot notation
 * @param obj - Object to set value in
 * @param path - Dot-separated path (e.g., 'execution.workerPoolSize')
 * @param value - Value to set
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!(key in current)) {
      current[key] = {};
    }
    return current[key];
  }, obj);

  // Try to parse as number if it looks like a number
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    target[lastKey] = parseInt(value, 10);
  } else if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
    target[lastKey] = parseFloat(value);
  } else if (value === 'true') {
    target[lastKey] = true;
  } else if (value === 'false') {
    target[lastKey] = false;
  } else {
    target[lastKey] = value;
  }
}

/**
 * Validate configuration object
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: Config): void {
  // Validate required fields
  if (!config.dataDir) {
    throw new Error('dataDir is required');
  }
  if (!config.dbPath) {
    throw new Error('dbPath is required');
  }
  if (!config.rootAgentId) {
    throw new Error('rootAgentId is required');
  }

  // Validate execution settings
  if (config.execution) {
    if (config.execution.workerPoolSize !== undefined) {
      if (typeof config.execution.workerPoolSize !== 'number') {
        throw new Error('execution.workerPoolSize must be a number');
      }
      if (config.execution.workerPoolSize < 1) {
        throw new Error('execution.workerPoolSize must be >= 1');
      }
      if (config.execution.workerPoolSize > 100) {
        throw new Error('execution.workerPoolSize must be <= 100');
      }
    }
    if (config.execution.maxConcurrentTasks !== undefined) {
      if (typeof config.execution.maxConcurrentTasks !== 'number') {
        throw new Error('execution.maxConcurrentTasks must be a number');
      }
      if (config.execution.maxConcurrentTasks < 1) {
        throw new Error('execution.maxConcurrentTasks must be >= 1');
      }
      if (config.execution.maxConcurrentTasks > 1000) {
        throw new Error('execution.maxConcurrentTasks must be <= 1000');
      }
    }
  }
}
