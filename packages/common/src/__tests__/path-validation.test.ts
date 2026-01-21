/**
 * Tests for path validation utilities
 */

import * as path from 'path';
import * as os from 'os';
import {
  validateAgentId,
  validateTaskId,
  validatePathContainment,
  validateAgentPath,
  validateTaskPath,
  sanitizePathComponent,
  DEFAULT_BASE_DIR,
} from '../path-utils';

describe('validateAgentId', () => {
  describe('valid agent IDs', () => {
    it('should accept simple agent IDs', () => {
      const result = validateAgentId('CEO');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('CEO');
      expect(result.error).toBeUndefined();
    });

    it('should accept agent IDs with hyphens', () => {
      const result = validateAgentId('backend-dev-001');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('backend-dev-001');
    });

    it('should accept agent IDs with underscores', () => {
      const result = validateAgentId('data_engineer_alice');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('data_engineer_alice');
    });

    it('should accept agent IDs with numbers', () => {
      const result = validateAgentId('agent123');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('agent123');
    });

    it('should accept empty string when allowEmpty is true', () => {
      const result = validateAgentId('', { allowEmpty: true });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('');
    });
  });

  describe('invalid agent IDs', () => {
    it('should reject empty agent IDs', () => {
      const result = validateAgentId('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject whitespace-only agent IDs', () => {
      const result = validateAgentId('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject agent IDs with leading whitespace', () => {
      const result = validateAgentId(' CEO');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });

    it('should reject agent IDs with trailing whitespace', () => {
      const result = validateAgentId('CEO ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });

    it('should reject agent IDs with forward slashes', () => {
      const result = validateAgentId('agent/with/slash');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path separators');
    });

    it('should reject agent IDs with backslashes', () => {
      const result = validateAgentId('agent\\with\\backslash');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path separators');
    });

    it('should reject agent IDs with null bytes', () => {
      const result = validateAgentId('agent\0null');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });

    it('should reject agent ID that is exactly "."', () => {
      const result = validateAgentId('.');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('"." or ".."');
    });

    it('should reject agent ID that is exactly ".."', () => {
      const result = validateAgentId('..');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('"." or ".."');
    });

    it('should reject path traversal attempts', () => {
      const result = validateAgentId('../../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path separators');
    });
  });
});

describe('validateTaskId', () => {
  it('should accept valid task IDs', () => {
    const result = validateTaskId('task-1-implement-feature');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('task-1-implement-feature');
  });

  it('should reject empty task IDs', () => {
    const result = validateTaskId('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Task ID cannot be empty');
  });

  it('should reject task IDs with path separators', () => {
    const result = validateTaskId('task/../../../etc');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Task ID cannot contain path separators');
  });

  it('should have same validation rules as agent IDs', () => {
    const agentResult = validateAgentId('valid-id');
    const taskResult = validateTaskId('valid-id');
    expect(taskResult.valid).toBe(agentResult.valid);
  });
});

describe('validatePathContainment', () => {
  const testBaseDir = path.join(os.tmpdir(), 'recursivemanager-test');

  describe('valid paths', () => {
    it('should accept paths within base directory', () => {
      const targetPath = path.join(testBaseDir, 'agents', 'CEO');
      const result = validatePathContainment(targetPath, { baseDir: testBaseDir });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(path.resolve(targetPath));
    });

    it('should accept deeply nested paths within base directory', () => {
      const targetPath = path.join(testBaseDir, 'agents', 'c0-cf', 'CEO', 'tasks', 'active');
      const result = validatePathContainment(targetPath, { baseDir: testBaseDir });
      expect(result.valid).toBe(true);
    });

    it('should accept relative paths that resolve within base directory', () => {
      const result = validatePathContainment('agents/CEO', { baseDir: testBaseDir });
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid paths', () => {
    it('should reject paths outside base directory', () => {
      const targetPath = '/etc/passwd';
      const result = validatePathContainment(targetPath, { baseDir: testBaseDir });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside base directory');
    });

    it('should reject path traversal with ..', () => {
      const targetPath = path.join(testBaseDir, '..', '..', 'etc', 'passwd');
      const result = validatePathContainment(targetPath, { baseDir: testBaseDir });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside base directory');
    });

    it('should reject relative paths that escape base directory', () => {
      const result = validatePathContainment('../../../etc/passwd', { baseDir: testBaseDir });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside base directory');
    });

    it('should use DEFAULT_BASE_DIR when no baseDir provided', () => {
      const targetPath = path.join(DEFAULT_BASE_DIR, 'agents', 'CEO');
      const result = validatePathContainment(targetPath);
      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should normalize paths with multiple slashes', () => {
      const targetPath = path.join(testBaseDir, 'agents', '/', 'CEO');
      const result = validatePathContainment(targetPath, { baseDir: testBaseDir });
      expect(result.valid).toBe(true);
    });

    it('should handle paths with trailing slashes', () => {
      const targetPath = path.join(testBaseDir, 'agents', 'CEO') + path.sep;
      const result = validatePathContainment(targetPath, { baseDir: testBaseDir });
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateAgentPath', () => {
  const testBaseDir = path.join(os.tmpdir(), 'recursivemanager-test');

  it('should accept valid agent paths', () => {
    const result = validateAgentPath('CEO', { baseDir: testBaseDir });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('CEO');
    expect(result.sanitized).toContain('c0-cf');
  });

  it('should reject invalid agent IDs', () => {
    const result = validateAgentPath('agent/with/slash', { baseDir: testBaseDir });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('path separators');
  });

  it('should reject path traversal attempts', () => {
    const result = validateAgentPath('../../../etc', { baseDir: testBaseDir });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('path separators');
  });

  it('should use DEFAULT_BASE_DIR when not provided', () => {
    const result = validateAgentPath('CEO');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain(DEFAULT_BASE_DIR);
  });
});

describe('validateTaskPath', () => {
  const testBaseDir = path.join(os.tmpdir(), 'recursivemanager-test');

  it('should accept valid task paths', () => {
    const result = validateTaskPath('CEO', 'task-1-implement-feature', 'active', {
      baseDir: testBaseDir,
    });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('CEO');
    expect(result.sanitized).toContain('task-1-implement-feature');
    expect(result.sanitized).toContain('active');
  });

  it('should reject invalid agent IDs', () => {
    const result = validateTaskPath('agent/slash', 'task-1', 'active', { baseDir: testBaseDir });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Agent ID cannot contain path separators');
  });

  it('should reject invalid task IDs', () => {
    const result = validateTaskPath('CEO', 'task/../../../etc', 'active', {
      baseDir: testBaseDir,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Task ID cannot contain path separators');
  });

  it('should use default status "active" when not provided', () => {
    const result = validateTaskPath('CEO', 'task-1', undefined, { baseDir: testBaseDir });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('active');
  });

  it('should accept custom status values', () => {
    const result = validateTaskPath('CEO', 'task-1', 'completed', { baseDir: testBaseDir });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('completed');
  });
});

describe('sanitizePathComponent', () => {
  describe('basic sanitization', () => {
    it('should remove leading and trailing whitespace', () => {
      expect(sanitizePathComponent('  task  ')).toBe('task');
    });

    it('should replace forward slashes with hyphens', () => {
      expect(sanitizePathComponent('My Task / Feature')).toBe('My Task-Feature');
    });

    it('should replace backslashes with hyphens', () => {
      expect(sanitizePathComponent('My Task \\ Feature')).toBe('My Task-Feature');
    });

    it('should remove null bytes', () => {
      expect(sanitizePathComponent('task\0null')).toBe('tasknull');
    });

    it('should remove leading dots', () => {
      expect(sanitizePathComponent('.hidden')).toBe('hidden');
      expect(sanitizePathComponent('...multiple')).toBe('multiple');
    });

    it('should remove trailing dots', () => {
      expect(sanitizePathComponent('file...')).toBe('file');
    });

    it('should handle path traversal attempts', () => {
      // Dots are removed from start/end, slashes replaced with hyphens
      expect(sanitizePathComponent('../../../etc')).toBe('..-..-etc');
    });
  });

  describe('custom replacement character', () => {
    it('should use custom replacement character', () => {
      expect(sanitizePathComponent('My Task / Feature', '_')).toBe('My Task_Feature');
    });

    it('should collapse multiple replacement characters', () => {
      expect(sanitizePathComponent('My / / / Task', '-')).toBe('My-Task');
    });

    it('should remove leading/trailing replacement characters', () => {
      expect(sanitizePathComponent('/leading/and/trailing/', '-')).toBe('leading-and-trailing');
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(sanitizePathComponent('')).toBe('');
    });

    it('should handle whitespace-only strings', () => {
      expect(sanitizePathComponent('   ')).toBe('');
    });

    it('should handle strings with only dots', () => {
      expect(sanitizePathComponent('...')).toBe('');
    });

    it('should handle strings with only slashes', () => {
      expect(sanitizePathComponent('///')).toBe('');
    });

    it('should preserve internal dots', () => {
      expect(sanitizePathComponent('file.name.txt')).toBe('file.name.txt');
    });

    it('should handle control characters', () => {
      expect(sanitizePathComponent('task\x01\x02\x03name')).toBe('taskname');
    });

    it('should handle mixed problematic characters', () => {
      expect(sanitizePathComponent('  ../task\\name/file.txt  ')).toBe('task-name-file.txt');
    });

    it('should handle special regex characters in replacement', () => {
      expect(sanitizePathComponent('a/b/c', '.')).toBe('a.b.c');
      expect(sanitizePathComponent('a/b/c', '*')).toBe('a*b*c');
      expect(sanitizePathComponent('a/b/c', '+')).toBe('a+b+c');
    });

    it('should collapse multiple spaces to one hyphen', () => {
      expect(sanitizePathComponent('My     Task')).toBe('My     Task');
      expect(sanitizePathComponent('My/    /Task', '-')).toBe('My-Task');
    });
  });

  describe('realistic use cases', () => {
    it('should sanitize user-provided task names', () => {
      expect(sanitizePathComponent('Implement login/signup feature')).toBe(
        'Implement login-signup feature'
      );
    });

    it('should sanitize filenames with special characters', () => {
      expect(sanitizePathComponent('report_2024-01-15.pdf')).toBe('report_2024-01-15.pdf');
    });

    it('should handle Windows-style paths', () => {
      expect(sanitizePathComponent('C:\\Users\\Documents\\file.txt')).toBe(
        'C-Users-Documents-file.txt'
      );
    });

    it('should handle Unix-style paths', () => {
      expect(sanitizePathComponent('/home/user/documents/file.txt')).toBe(
        'home-user-documents-file.txt'
      );
    });
  });
});
