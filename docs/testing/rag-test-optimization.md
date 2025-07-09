# RAG Test Optimization Guide

This guide provides strategies and tools for optimizing RAG (Retrieval-Augmented Generation) integration tests to reduce timeouts and improve test reliability.

## Problem Statement

RAG integration tests can be slow due to:
- LLM inference times with large models (qwen3:8b takes 30+ seconds)
- Large context windows requiring extensive processing
- Multiple document retrieval and ranking operations
- Embedding generation for documents and queries
- Complex multi-step RAG pipeline execution

## Solutions Implemented

### Fast Models and Real Embeddings
- **Phi3:mini**: Fast inference model (10-20 seconds vs 30+ seconds)
- **Real Ollama Embeddings**: Authentic mxbai-embed-large for genuine testing
- **Unified Architecture**: Same embedding provider for storage and retrieval
- **Optimized Thresholds**: 0.3 threshold for real embeddings vs mock limitations

## Optimization Strategies

### 1. Environment-Based Test Configuration

Use environment variables to control test behavior:

```bash
# Skip Ollama tests entirely (for CI without Ollama)
SKIP_OLLAMA_TESTS=true npm test

# Use fast mode with minimal resources
FAST_MODE=true npm test

# Normal integration tests
npm test
```

### 2. Optimized Test Configuration

The `test-config.ts` provides configurable test parameters:

```typescript
import { getTestConfig, getOptimizedRagOptions } from './test-config';

const config = getTestConfig();
const ragOptions = getOptimizedRagOptions(config);

// Use optimized settings for faster tests
const response = await ragSystem.askQuestion(
  'What is AI?',
  [],
  ragOptions // { maxSources: 2, maxDocuments: 2, includeSource: true }
);
```

### 3. Real Embeddings Integration

Use authentic Ollama embeddings for genuine testing:

```typescript
import { OllamaEmbeddingProvider } from '../../../src/knowledge/search/OllamaEmbeddingProvider';

// Initialize real embeddings
const embeddingProvider = new OllamaEmbeddingProvider(
  'mxbai-embed-large:latest', 
  1024,
  'http://localhost:11434'
);

// Set unified embedding provider
vectorStore.setEmbeddingProvider(embeddingProvider);

// Configure semantic search with real embeddings
const semanticSearch = new SemanticSearchEngine(
  vectorStore,
  embeddingProvider,
  undefined,
  { defaultThreshold: 0.3, defaultLimit: 5 }
);
```

### 4. Optimized RAG Adapter

The `OllamaRAGAdapterOptimized` provides test-specific optimizations:

```typescript
import { OllamaRAGAdapterOptimized } from '../../../src/integrations/ai/OllamaRAGAdapterOptimized';

// Create optimized adapter for tests (phi3:mini recommended)
const adapter = OllamaRAGAdapterOptimized.createPhi3AdapterOptimized();

// Includes:
// - Fast phi3:mini model (10-20s vs 30+ seconds)
// - Lower temperature (0.1) for deterministic responses
// - Reduced max tokens (512) for faster generation
// - Streaming support for faster feedback
// - Test-specific metadata
```

## Performance Optimizations Applied

| **Parameter** | **Standard (Qwen3)** | **Optimized (Phi3)** | **Performance Gain** |
|---------------|----------------------|----------------------|---------------------|
| Model | qwen3:8b | phi3:mini | 50% faster inference |
| Inference Time | 30+ seconds | 10-20 seconds | 2-3x faster |
| Embeddings | Mock/Random | Real Ollama | Authentic testing |
| Embedding Dims | 1536 (mixed) | 1024 (consistent) | Unified pipeline |
| Threshold | 0.05-0.7 (inconsistent) | 0.3 (optimized) | Better matching |
| Context Length | 8000 tokens | 8000 tokens | Same quality |
| Temperature | 0.7 | 0.1 | More deterministic |
| Max Tokens | 2000 | 512 | 4x faster generation |
| Setup Time | Variable | 10-15 seconds | Predictable |

## Test Types and Strategies

### 1. Unit Tests (Fastest)
- Use mocked providers
- No actual AI inference  
- Focus on logic and data flow
- Execution time: < 1 second

### 2. Integration Tests with Real Embeddings (Recommended)
- Use real Ollama embeddings (mxbai-embed-large)
- Phi3:mini for fast LLM inference
- Authentic semantic search testing
- Execution time: 10-20 seconds per question
- Benefits: Genuine testing without mock limitations

### 3. Full Integration Tests (Comprehensive)
- Real embeddings + larger models (qwen3:8b)
- Complete RAG pipeline testing
- Multi-turn conversations and edge cases
- Execution time: 30+ seconds per question
- Benefits: Production-like testing

```typescript
// Mock the RAG adapter for unit tests
jest.mock('../../../src/integrations/ai/OllamaRAGAdapter');
```

### 2. Integration Tests (Fast Mode)
- Use `OllamaRAGAdapterOptimized`
- Minimal knowledge base (2-3 documents)
- Reduced parameters
- Execution time: 30-60 seconds

```typescript
describe('RAG Integration - Fast', () => {
  const testConfig = getTestConfig();
  // Uses FAST_MODE configuration if enabled
});
```

### 3. Integration Tests (Full)
- Complete RAG pipeline testing
- Full knowledge base
- All features enabled
- Execution time: 2-5 minutes

```typescript
describe('RAG Integration - Complete', () => {
  // Full test suite with comprehensive coverage
});
```

### 4. Performance Tests
- Measure response times
- Test concurrent requests
- Monitor resource usage
- Benchmark optimizations

## Streaming Support (Future Enhancement)

The optimized adapter includes streaming infrastructure:

```typescript
// Streaming will provide incremental feedback
await adapter.generateTextStream(
  request,
  (chunk: string) => {
    console.log('Received:', chunk);
    // Process chunk immediately
  }
);
```

**Benefits of Streaming:**
- **Immediate feedback** - see response start instantly
- **Timeout detection** - know if system is responsive
- **Progressive loading** - build response incrementally
- **Better UX** - perceived performance improvement

## Environment Setup and Health Checks

### Automatic Environment Detection

```typescript
import { setupTestEnvironment, isOllamaAvailable } from './test-config';

beforeAll(async () => {
  const testEnv = await setupTestEnvironment();
  
  if (testEnv.skip) {
    console.log(`Skipping tests: ${testEnv.reason}`);
    return;
  }
  
  // Proceed with test setup
});
```

### Health Checks

The framework includes automatic health checks:

```typescript
// Check if Ollama is available and responsive
const available = await isOllamaAvailable();

if (!available) {
  console.log('Ollama not available - skipping integration tests');
  return;
}
```

## Timeout Management

### Timeout-Aware Test Wrapper

```typescript
import { withTimeout } from './test-config';

it('should respond quickly', async () => {
  const response = await withTimeout(
    () => ragSystem.askQuestion('What is AI?', [], options),
    60000, // 1 minute timeout
    'Quick AI question'
  );
  
  expect(response.success).toBe(true);
}, 90000); // Jest timeout slightly higher
```

### Progressive Timeouts

- **Setup**: 30 seconds (optimized initialization)
- **Simple queries**: 60 seconds (basic RAG operations)  
- **Complex queries**: 180 seconds (multi-document reasoning)
- **Performance tests**: 300 seconds (concurrent operations)

## Best Practices

### 1. Test Organization

```
tests/integration/knowledge/
├── test-config.ts              # Shared configuration
├── RAGIntegration.test.ts      # Original comprehensive tests
├── RAGIntegration.optimized.test.ts  # Fast optimized tests
└── RAGIntegration.performance.test.ts # Performance benchmarks
```

### 2. Configuration Management

- Use environment variables for CI/CD flexibility
- Provide multiple configuration presets
- Allow per-test customization
- Include sensible defaults

### 3. Error Handling

```typescript
try {
  const response = await ragSystem.askQuestion(query, [], options);
  expect(response.success).toBe(true);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.warn('Test timed out - this may indicate infrastructure issues');
  }
  throw error;
}
```

### 4. Logging and Monitoring

```typescript
console.log(`Response time: ${responseTime}ms`);
console.log(`Sources found: ${response.sources?.length || 0}`);
console.log(`Confidence: ${response.confidence}`);
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run RAG Tests (Fast Mode)
  run: FAST_MODE=true npm run test:integration:rag
  
- name: Run RAG Tests (Skip if no Ollama)
  run: SKIP_OLLAMA_TESTS=true npm run test:integration:rag
  if: env.OLLAMA_AVAILABLE != 'true'
```

### Docker Integration

```dockerfile
# Conditional Ollama setup for testing
ARG ENABLE_OLLAMA=false
RUN if [ "$ENABLE_OLLAMA" = "true" ]; then \
      curl -fsSL https://ollama.com/install.sh | sh; \
    fi
```

## Troubleshooting

### Common Issues

1. **Tests timeout consistently**
   - Enable `FAST_MODE=true`
   - Check Ollama model availability
   - Verify system resources

2. **Inconsistent results**
   - Use lower temperature (0.1)
   - Reduce context variability
   - Check model determinism

3. **Setup failures**
   - Verify Ollama installation
   - Check port availability (11434)
   - Validate model downloads

### Debugging Tools

```typescript
// Enable detailed logging
process.env.LOG_LEVEL = 'debug';

// Check adapter health
const health = await adapter.healthCheck();
console.log('Adapter health:', health);

// Monitor performance
const startTime = Date.now();
// ... test operation
const duration = Date.now() - startTime;
console.log(`Operation took: ${duration}ms`);
```

## Future Enhancements

1. **True Streaming**: Real-time token streaming from Ollama
2. **Response Caching**: Cache common responses for instant replay
3. **Progressive Loading**: Incremental knowledge base loading
4. **Health-Based Skipping**: Skip tests based on system health
5. **Performance Baselines**: Automated performance regression detection

## Conclusion

These optimizations provide immediate relief from timeout issues while maintaining comprehensive test coverage. The framework scales from fast unit tests to complete integration testing, with flexibility for different environments and use cases.

For implementation details, see:
- `tests/integration/knowledge/test-config.ts` - Configuration management
- `src/integrations/ai/OllamaRAGAdapterOptimized.ts` - Optimized adapter
- `tests/integration/knowledge/RAGIntegration.optimized.test.ts` - Example usage