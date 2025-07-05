# RAG System Configuration Options

The Claudate RAG system supports multiple AI providers including the Claude CLI, making it flexible for different use cases and preferences.

## Option 1: Claude CLI (Recommended for Development)

Uses your existing Claude CLI installation - no API keys needed!

```typescript
import { RAGSystem } from '../src/knowledge/rag/RAGSystem';
import { RAGProviderFactory } from '../src/utils/ragProviderFactory';

// Automatic setup with CLI preference
const providers = await RAGProviderFactory.createProviders({
  preferCLI: true,
  enableFallbacks: true  // Will fallback to API if CLI unavailable
});

const ragSystem = new RAGSystem(semanticSearchEngine, providers, {
  maxContextLength: 100000,
  retrievalStrategy: 'similarity'
});
```

## Option 2: API Only (Production)

Use API keys for reliable, scalable production usage:

```typescript
const providers = RAGProviderFactory.createAPIOnlyProviders({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY
});

const ragSystem = new RAGSystem(semanticSearchEngine, providers, config);
```

## Option 3: CLI Only (Cost-Sensitive)

Use only the CLI to avoid API costs:

```typescript
const providers = await RAGProviderFactory.createCLIOnlyProvider({
  timeout: 30000
});

const ragSystem = new RAGSystem(semanticSearchEngine, providers, config);
```

## Option 4: Custom Configuration

Mix and match based on your specific needs:

```typescript
import { ClaudeCLIClient } from '../src/integrations/ai/ClaudeCLIClient';
import { AnthropicClient } from '../src/integrations/ai/AnthropicClient';

// Create custom providers
const cliClient = new ClaudeCLIClient({ timeout: 45000 });
const apiClient = new AnthropicClient({ apiKey: 'your-key' });

const customProviders = [
  {
    name: 'claude-cli' as const,
    client: cliClient,
    priority: 1,  // Try CLI first
    maxContextLength: 150000
  },
  {
    name: 'claude' as const,
    client: apiClient,
    priority: 2,  // Fallback to API
    maxContextLength: 100000
  }
];

const ragSystem = new RAGSystem(semanticSearchEngine, customProviders, config);
```

## Use Case Recommendations

### Development & Prototyping
```typescript
const providers = await RAGProviderFactory.createProviders(
  RAGProviderFactory.getProviderRecommendations('development')
);
```
- **Benefits**: No API key management, familiar CLI interface
- **Best for**: Local development, experimentation, learning

### Production Deployment
```typescript
const providers = await RAGProviderFactory.createProviders(
  RAGProviderFactory.getProviderRecommendations('production')
);
```
- **Benefits**: Reliable, scalable, concurrent requests
- **Best for**: Production apps, high availability requirements

### Cost-Sensitive Projects
```typescript
const providers = await RAGProviderFactory.createProviders(
  RAGProviderFactory.getProviderRecommendations('cost-sensitive')
);
```
- **Benefits**: Uses existing Claude subscription, no additional API costs
- **Best for**: Personal projects, budget-conscious development

### High-Throughput Applications
```typescript
const providers = await RAGProviderFactory.createProviders(
  RAGProviderFactory.getProviderRecommendations('high-throughput')
);
```
- **Benefits**: Optimized for speed and concurrent processing
- **Best for**: Large-scale data processing, batch operations

## Environment Setup

### For CLI Usage
1. Install Claude CLI: Follow Anthropic's installation guide
2. Authenticate: `claude auth login`
3. Test: `echo "Hello" | claude`

### For API Usage
1. Set environment variables:
   ```bash
   export ANTHROPIC_API_KEY="your-anthropic-key"
   export GEMINI_API_KEY="your-gemini-key"
   ```

### For Mixed Mode (Recommended)
Set up both CLI and environment variables for maximum flexibility:
```bash
# Install and setup CLI
claude auth login

# Set API keys as backup
export ANTHROPIC_API_KEY="your-key"
export GEMINI_API_KEY="your-key"
```

## Benefits of Claude CLI Integration

1. **No API Key Management**: Uses your existing Claude authentication
2. **Cost Control**: Leverages your Claude subscription, no per-request charges
3. **Familiar Interface**: If you already use Claude CLI, this feels natural
4. **Large Context Windows**: CLI can handle very large context sizes
5. **Offline Development**: Works without internet for cached responses
6. **Graceful Fallbacks**: Can automatically fallback to API if CLI unavailable

## Provider Priority System

The RAG system tries providers in priority order:
1. **Priority 1**: Primary choice (usually CLI for development)
2. **Priority 2**: First fallback (usually API)
3. **Priority 3**: Additional fallbacks (other APIs)

If a provider fails, the system automatically tries the next one, ensuring reliable operation.

## Error Handling

The system gracefully handles various scenarios:
- CLI not installed → Falls back to API
- API rate limits → Tries next provider
- Network issues → Uses available alternatives
- Invalid keys → Skips that provider

This ensures your RAG system keeps working even when some providers are unavailable.