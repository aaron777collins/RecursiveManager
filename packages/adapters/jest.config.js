/**
 * Jest configuration for @recursive-manager/adapters package
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'adapters',

  roots: ['<rootDir>/src'],

  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },

  // Module path aliases for internal package references
  moduleNameMapper: {
    '^@recursive-manager/common$': '<rootDir>/../common/src',
    '^@recursive-manager/core$': '<rootDir>/../core/src'
  },

  // Transform ESM modules
  transformIgnorePatterns: [
    'node_modules/(?!(execa)/)'
  ],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**'
  ],

  coverageDirectory: '<rootDir>/coverage',

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  clearMocks: true,
  restoreMocks: true
};
