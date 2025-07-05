export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  testMatch: [
    '**/tests/integration/knowledge/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }]
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/knowledge/setup.ts'
  ],
  testTimeout: 60000, // 60 seconds for integration tests
  maxWorkers: 1, // Run tests sequentially to avoid conflicts
  collectCoverage: true,
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/'
  ],
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};