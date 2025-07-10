module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/health-check.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'clover',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  testTimeout: 15000,
  verbose: false, // Reduce output to prevent terminal overflow
  clearMocks: true,
  restoreMocks: true,
  // Maximum safety isolation settings
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  bail: true, // Stop on first failure
  // Memory and resource limits
  maxConcurrency: 1,
  // Prevent hanging tests
  testNamePattern: '^((?!integration|e2e).)*$', // Skip integration tests by default
  // Safer error handling
  errorOnDeprecated: false,
  silent: false,
  // Clean up after each test
  resetModules: true,
  resetMocks: true,
};