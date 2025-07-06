/**
 * Jest Configuration for Integration Tests
 * 
 * Uses SQLite test database and mocked external dependencies
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  // setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.ts'],
  collectCoverage: false,
  verbose: true,
  testTimeout: 30000,
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  // globalSetup: '<rootDir>/tests/setup/global-setup.js',
  // globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  roots: ['<rootDir>/tests/integration'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage-integration',
  coverageReporters: ['text', 'lcov', 'html'],
  // Environment variables for testing
  setupFiles: ['<rootDir>/tests/setup/test-env.ts']
};