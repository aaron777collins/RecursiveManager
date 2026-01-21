/**
 * Path resolution utilities for CLI
 *
 * Handles finding the installation root directory across different scenarios:
 * - Development mode (monorepo)
 * - npm global install
 * - npm local install
 * - Custom installation directory
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the installation root directory where RecursiveManager is installed
 *
 * Search strategy:
 * 1. Start from current file location (__dirname)
 * 2. Walk up directory tree looking for marker files:
 *    - package.json with name "recursivemanager" (monorepo root)
 *    - scripts/install.sh and scripts/update.sh (installation root)
 * 3. Fall back to default installation directory (~/.recursivemanager)
 *
 * @returns Absolute path to installation root directory
 */
export function getInstallRoot(): string {
  // Start from the compiled CLI dist directory
  // In development: /path/to/RecursiveManager/packages/cli/dist/utils/paths.js
  // After npm install: /path/to/node_modules/@recursivemanager/cli/dist/utils/paths.js
  let currentDir = __dirname;

  // Walk up the directory tree looking for the installation root
  for (let i = 0; i < 10; i++) {
    // Check for monorepo root (package.json with name "recursivemanager")
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.name === 'recursivemanager') {
          return currentDir;
        }
      } catch (err) {
        // Invalid JSON, continue searching
      }
    }

    // Check for scripts directory (install.sh and update.sh)
    const scriptsDir = path.join(currentDir, 'scripts');
    const installScript = path.join(scriptsDir, 'install.sh');
    const updateScript = path.join(scriptsDir, 'update.sh');
    if (fs.existsSync(installScript) && fs.existsSync(updateScript)) {
      return currentDir;
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root, stop searching
      break;
    }
    currentDir = parentDir;
  }

  // Fall back to default installation directory
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.recursivemanager');
}

/**
 * Get the path to the scripts directory
 * @returns Absolute path to scripts directory
 */
export function getScriptsDir(): string {
  return path.join(getInstallRoot(), 'scripts');
}

/**
 * Get the path to a specific script file
 * @param scriptName - Name of the script (e.g., 'update.sh', 'install.sh')
 * @returns Absolute path to script file
 */
export function getScriptPath(scriptName: string): string {
  return path.join(getScriptsDir(), scriptName);
}
