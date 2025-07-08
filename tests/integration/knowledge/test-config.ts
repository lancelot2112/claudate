/**
 * Test Configuration for Knowledge Integration Tests
 * 
 * This file provides optimized configurations and utilities for knowledge
 * integration tests to improve performance and reliability.
 */

export interface TestConfig {
  useOptimizedAdapter: boolean;
  enableStreaming: boolean;
  maxContextLength: number;
  maxSources: number;
  maxDocuments: number;
  timeout: number;
  skipOllamaTests: boolean;
  fastMode: boolean;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  useOptimizedAdapter: true,
  enableStreaming: true,
  maxContextLength: 2000, // Reduced for faster tests
  maxSources: 2, // Fewer sources for faster retrieval
  maxDocuments: 2, // Fewer documents for faster processing
  timeout: 180000, // 3 minutes
  skipOllamaTests: process.env.SKIP_OLLAMA_TESTS === 'true',
  fastMode: process.env.FAST_MODE === 'true'
};

export const FAST_TEST_CONFIG: TestConfig = {
  ...DEFAULT_TEST_CONFIG,
  maxContextLength: 1000,
  maxSources: 1,
  maxDocuments: 1,
  timeout: 60000, // 1 minute
  fastMode: true
};

export function getTestConfig(): TestConfig {
  if (process.env.FAST_MODE === 'true') {
    return FAST_TEST_CONFIG;
  }
  return DEFAULT_TEST_CONFIG;
}

export function shouldSkipTest(testName: string): boolean {
  const config = getTestConfig();
  
  if (config.skipOllamaTests) {
    console.log(`Skipping ${testName} - Ollama tests disabled`);
    return true;
  }
  
  return false;
}

export function getOptimizedRagOptions(config: TestConfig = getTestConfig()) {
  return {
    includeSource: true,
    maxSources: config.maxSources,
    maxDocuments: config.maxDocuments
  };
}

export function getOptimizedRagProviderConfig(adapter: any, config: TestConfig = getTestConfig()) {
  return [{
    name: 'ollama-optimized',
    client: adapter,
    priority: 1,
    maxContextLength: config.maxContextLength
  }];
}

export function getOptimizedRagSystemConfig(config: TestConfig = getTestConfig()) {
  return {
    maxContextLength: config.maxContextLength,
    retrievalStrategy: 'similarity' as const
  };
}

/**
 * Utility to create a timeout-aware test wrapper
 */
export function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  testName: string
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Test "${testName}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Utility to check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    await execAsync('ollama list', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Setup test environment with health checks
 */
export async function setupTestEnvironment() {
  const config = getTestConfig();
  
  if (config.skipOllamaTests) {
    console.log('Ollama tests disabled via SKIP_OLLAMA_TESTS=true');
    return { skip: true, reason: 'Ollama tests disabled' };
  }
  
  const ollamaAvailable = await isOllamaAvailable();
  if (!ollamaAvailable) {
    console.log('Ollama not available - skipping integration tests');
    return { skip: true, reason: 'Ollama not available' };
  }
  
  console.log('Test environment ready', { config });
  return { skip: false, config };
}

export default {
  DEFAULT_TEST_CONFIG,
  FAST_TEST_CONFIG,
  getTestConfig,
  shouldSkipTest,
  getOptimizedRagOptions,
  getOptimizedRagProviderConfig,
  getOptimizedRagSystemConfig,
  withTimeout,
  isOllamaAvailable,
  setupTestEnvironment
};