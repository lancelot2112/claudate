import { beforeAll, afterAll } from '@jest/globals';

// Global test setup for knowledge management integration tests

beforeAll(async () => {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  
  // Database configuration for tests
  process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
  process.env.DB_NAME = process.env.TEST_DB_NAME || 'claudate_test';
  process.env.DB_USER = process.env.TEST_DB_USER || 'test';
  process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'test';

  // Redis configuration for tests
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

  // Vector database configuration
  process.env.CHROMA_URL = process.env.TEST_CHROMA_URL || 'http://localhost:8000';

  // AI API keys (use test keys if real ones not available)
  if (!process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    console.warn('Using test OpenAI API key - some tests may fail or be skipped');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    console.warn('Using test Anthropic API key - some tests may fail or be skipped');
  }

  if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    console.warn('Using test Gemini API key - some tests may fail or be skipped');
  }

  console.log('🧪 Knowledge Management Integration Tests - Setup Complete');
});

afterAll(async () => {
  console.log('🧪 Knowledge Management Integration Tests - Cleanup Complete');
});