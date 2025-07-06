/**
 * Test Environment Setup
 * 
 * Sets up environment variables for integration tests
 */

import path from 'path';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = path.join(__dirname, '..', '..', 'test-database.sqlite');
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

// Real database URLs for integration tests
process.env.DATABASE_URL = 'postgresql://claudate:claudate_dev_password@localhost:5432/claudate';
process.env.REDIS_URL = 'redis://:claudate_redis_password@localhost:6379';
process.env.CHROMA_URL = 'http://localhost:8000';

// Use real API keys if available, otherwise use test keys
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-anthropic';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-gemini';

// Test-specific configuration - use real services
process.env.VECTOR_STORE_TYPE = 'chroma';
process.env.SEARCH_ENGINE_TYPE = 'semantic';
process.env.AI_PROVIDER_TYPE = 'anthropic';
process.env.EMBEDDING_PROVIDER = 'ollama'; // Use Ollama embeddings
process.env.OLLAMA_HOST = 'localhost';
process.env.OLLAMA_PORT = '11434';

console.log('Test environment configured');
console.log('- Database:', process.env.DATABASE_URL);
console.log('- Redis:', process.env.REDIS_URL);
console.log('- Vector Store:', process.env.VECTOR_STORE_TYPE);
console.log('- AI Provider:', process.env.AI_PROVIDER_TYPE);
console.log('- Embedding Provider:', process.env.EMBEDDING_PROVIDER);
console.log('- Ollama Host:', `${process.env.OLLAMA_HOST}:${process.env.OLLAMA_PORT}`);