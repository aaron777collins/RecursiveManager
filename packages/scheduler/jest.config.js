/**
 * Jest configuration for @recursivemanager/scheduler package
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'scheduler',

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
    '^@recursivemanager/common$': '<rootDir>/../common/src',
    '^@recursivemanager/core$': '<rootDir>/../core/src'
  },

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
