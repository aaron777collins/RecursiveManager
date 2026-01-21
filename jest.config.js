/**
 * Root Jest configuration for RecursiveManager monorepo
 *
 * This configuration serves as the base for all package-specific Jest configs.
 * Each package should extend this configuration and customize as needed.
 */

module.exports = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',

  // Run tests in Node.js environment
  testEnvironment: 'node',

  // Root directory for tests
  roots: ['<rootDir>/packages'],

  // Test file patterns
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],

  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.base.json',
      },
    ],
  },

  // Module path aliases (matching tsconfig paths)
  moduleNameMapper: {
    '^@recursivemanager/common$': '<rootDir>/packages/common/src',
    '^@recursivemanager/core$': '<rootDir>/packages/core/src',
    '^@recursivemanager/cli$': '<rootDir>/packages/cli/src',
    '^@recursivemanager/scheduler$': '<rootDir>/packages/scheduler/src',
    '^@recursivemanager/adapters$': '<rootDir>/packages/adapters/src',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
    '!packages/*/src/**/__tests__/**',
  ],

  // Coverage thresholds (80% minimum as per quality gates)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Coverage output directory
  coverageDirectory: '<rootDir>/coverage',

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Maximum number of concurrent workers
  maxWorkers: '50%',
};
