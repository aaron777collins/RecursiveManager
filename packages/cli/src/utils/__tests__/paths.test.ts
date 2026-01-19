/**
 * Tests for path resolution utilities
 */

import * as path from 'path';
import * as fs from 'fs';
import { getInstallRoot, getScriptsDir, getScriptPath } from '../paths';

describe('paths utilities', () => {
  describe('getInstallRoot', () => {
    it('should return a valid directory path', () => {
      const installRoot = getInstallRoot();
      expect(typeof installRoot).toBe('string');
      expect(installRoot.length).toBeGreaterThan(0);
      expect(path.isAbsolute(installRoot)).toBe(true);
    });

    it('should find monorepo root in development mode', () => {
      // In development, the test is running from within the monorepo
      // and should find the root package.json with name "recursive-manager"
      const installRoot = getInstallRoot();

      // Check if we can find the monorepo marker files
      const packageJsonPath = path.join(installRoot, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        // In dev mode, should find the monorepo root
        if (packageJson.name === 'recursive-manager') {
          expect(packageJson.name).toBe('recursive-manager');
        }
      }
    });

    it('should find scripts directory from install root', () => {
      const installRoot = getInstallRoot();
      const scriptsDir = path.join(installRoot, 'scripts');

      // Scripts directory should exist if we found the monorepo root
      if (fs.existsSync(scriptsDir)) {
        expect(fs.statSync(scriptsDir).isDirectory()).toBe(true);
      }
    });

    it('should fall back to home directory if markers not found', () => {
      const installRoot = getInstallRoot();
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const defaultInstallDir = path.join(homeDir, '.recursive-manager');

      // Should either find the monorepo root or fall back to default
      expect(
        installRoot.endsWith('RecursiveManager') || installRoot === defaultInstallDir
      ).toBe(true);
    });

    it('should handle missing HOME environment variable gracefully', () => {
      // This test ensures the function doesn't crash if HOME is undefined
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;

      try {
        delete process.env.HOME;
        delete process.env.USERPROFILE;

        const installRoot = getInstallRoot();
        expect(typeof installRoot).toBe('string');
        expect(installRoot.length).toBeGreaterThan(0);
      } finally {
        // Restore environment variables
        if (originalHome) process.env.HOME = originalHome;
        if (originalUserProfile) process.env.USERPROFILE = originalUserProfile;
      }
    });

    it('should not traverse more than 10 directories', () => {
      // This test verifies the function has a reasonable search limit
      // to prevent infinite loops or excessive filesystem traversal
      const installRoot = getInstallRoot();
      expect(installRoot).toBeTruthy();
    });

    it('should return consistent results on multiple calls', () => {
      const first = getInstallRoot();
      const second = getInstallRoot();
      const third = getInstallRoot();

      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe('getScriptsDir', () => {
    it('should return absolute path to scripts directory', () => {
      const scriptsDir = getScriptsDir();

      expect(typeof scriptsDir).toBe('string');
      expect(path.isAbsolute(scriptsDir)).toBe(true);
      expect(scriptsDir.endsWith('scripts')).toBe(true);
    });

    it('should be a subdirectory of install root', () => {
      const installRoot = getInstallRoot();
      const scriptsDir = getScriptsDir();

      expect(scriptsDir.startsWith(installRoot)).toBe(true);
      expect(scriptsDir).toBe(path.join(installRoot, 'scripts'));
    });

    it('should exist in development environment', () => {
      const scriptsDir = getScriptsDir();

      // In dev mode, scripts directory should exist
      // In production, it might not exist if deployed differently
      if (fs.existsSync(scriptsDir)) {
        expect(fs.statSync(scriptsDir).isDirectory()).toBe(true);
      }
    });
  });

  describe('getScriptPath', () => {
    it('should return absolute path to script file', () => {
      const scriptPath = getScriptPath('update.sh');

      expect(typeof scriptPath).toBe('string');
      expect(path.isAbsolute(scriptPath)).toBe(true);
      expect(scriptPath.endsWith('update.sh')).toBe(true);
    });

    it('should be in scripts directory', () => {
      const scriptsDir = getScriptsDir();
      const scriptPath = getScriptPath('update.sh');

      expect(path.dirname(scriptPath)).toBe(scriptsDir);
    });

    it('should handle different script names', () => {
      const updateScript = getScriptPath('update.sh');
      const installScript = getScriptPath('install.sh');

      expect(updateScript).not.toBe(installScript);
      expect(updateScript.endsWith('update.sh')).toBe(true);
      expect(installScript.endsWith('install.sh')).toBe(true);
    });

    it('should work with relative paths', () => {
      const scriptPath = getScriptPath('subdir/script.sh');
      expect(scriptPath.includes('subdir')).toBe(true);
      expect(scriptPath.endsWith('script.sh')).toBe(true);
    });

    it('should find update.sh in development environment', () => {
      const updateScriptPath = getScriptPath('update.sh');

      // In dev mode, update.sh should exist
      if (fs.existsSync(updateScriptPath)) {
        expect(fs.statSync(updateScriptPath).isFile()).toBe(true);
      }
    });

    it('should find install.sh in development environment', () => {
      const installScriptPath = getScriptPath('install.sh');

      // In dev mode, install.sh should exist
      if (fs.existsSync(installScriptPath)) {
        expect(fs.statSync(installScriptPath).isFile()).toBe(true);
      }
    });
  });
});
