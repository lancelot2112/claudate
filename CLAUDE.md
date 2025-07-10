# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claudate is an agentic team framework that orchestrates specialized AI agents for collaborative software development using local AI models. The system uses a three-layer architecture with unified AI provider support and a comprehensive web dashboard:

- **Personal Assistant Layer**: Primary communication interface and routing hub
- **Strategic Layer (Local AI)**: High-level planning, architecture decisions, system design using local models
- **Execution Layer (Local AI)**: Implementation, testing, debugging, and tool execution using local models
- **Unified Provider System**: Abstract interface supporting multiple AI backends (currently Ollama)
- **Web Dashboard**: Real-time monitoring and management interface for agents, channels, and tasks

## Ollama Agent Architecture

The system now uses a **generic OllamaAgent** architecture instead of model-specific agents:

### Key Components
- **OllamaAgent**: Generic agent class that can work with any Ollama model
- **OllamaRAGAdapter**: Unified RAG interface adapter for knowledge systems
- **Factory Methods**: Convenient creation methods for common model configurations

### Model Support
- **Phi3 Models**: `phi3:mini` (recommended for fast testing)
- **Qwen Models**: `qwen3:8b`, `qwen2.5-coder:7b`
- **Llama Models**: `llama3.2:3b`, `llama3.2:1b`
- **Code Models**: Any code-focused Ollama model
- **Custom Models**: Any model available through Ollama

### Usage Examples
```typescript
// Create a generic agent with any model
const agent = new OllamaAgent({
  modelName: 'phi3:mini',
  name: 'my-agent',
  type: 'execution',
  capabilities: ['text_generation', 'reasoning']
});

// Use factory methods for common configurations
const phi3Agent = OllamaAgent.createPhi3Agent(config);
const qwen3Agent = OllamaAgent.createQwen3Agent(config);
const codeAgent = OllamaAgent.createCodeAgent(config);

// RAG integration (phi3:mini recommended for testing)
const ragAdapter = OllamaRAGAdapter.createPhi3Adapter();
const qwen3RagAdapter = OllamaRAGAdapter.createQwen3Adapter();
```

## Context Compression Architecture

The system includes an intelligent context compression system for efficient memory management:

### Key Features
- **Generic AI Provider Integration**: Works with any Ollama model through unified interface
- **Model-Aware Context Windows**: Respects model-specific limits (Qwen3: 8192, CodeLlama: 16384)
- **Configurable Prompt System**: Customizable compression behavior via `src/config/prompts.json`
- **Intelligent Fallbacks**: Semantic → Statistical compression hierarchy

### Usage Examples
```typescript
// Create context compressor with any provider
const compressor = new ContextCompressor(ollamaRAGAdapter);

// Compress with automatic context window management
const result = await compressor.compressContext(largeText);

// Custom compression behavior
compressor.setPromptOverride({
  systemPrompt: "Technical documentation compressor",
  compressionPrompt: "Preserve code examples and technical details: {content}"
});

// Different summarization styles
const summary = await compressor.summarizeContext(text, {
  style: 'executive',
  includeActionItems: true
});
```

### Compression Methods
- **Semantic Compression**: AI-powered, preserves meaning and relationships
- **Statistical Compression**: Keyword-based fallback for reliability  
- **Chunked Processing**: Handles content exceeding context windows
- **Custom Prompts**: Task-specific compression via PromptManager

### Configuration
```json
// src/config/prompts.json
{
  "compressor": {
    "systemPrompt": "You are an expert at text compression...",
    "compressionPrompt": "Compress to {targetLength} characters: {content}",
    "parameters": {
      "defaultTemperature": 0.3,
      "maxTokensMultiplier": 0.33
    }
  }
}
```

## Real Embedding Integration

The system uses authentic Ollama embeddings for semantic search and RAG systems:

### Embedding Architecture
- **OllamaEmbeddingProvider**: Real semantic embeddings via mxbai-embed-large:latest
- **Unified Provider**: Same embedding model for document storage and query retrieval
- **Dimension Consistency**: 1024-dimensional embeddings throughout pipeline
- **Semantic Thresholds**: 0.3 threshold for real embeddings vs 0.05 for mock testing

### VectorStore Integration
```typescript
// Initialize with real Ollama embeddings
const embeddingProvider = new OllamaEmbeddingProvider(
  'mxbai-embed-large:latest', 
  1024,
  'http://localhost:11434'
);

const vectorStore = new VectorStore({
  provider: 'chroma',
  collectionName: 'my-collection',
  dimensions: 1024
});

// Set unified embedding provider
vectorStore.setEmbeddingProvider(embeddingProvider);

// Initialize semantic search
const semanticSearch = new SemanticSearchEngine(
  vectorStore,
  embeddingProvider,
  undefined,
  { defaultThreshold: 0.3, defaultLimit: 5 }
);
```

### Benefits
- **Authentic Similarity**: Real semantic calculations vs mock limitations
- **Natural Language**: Queries work with genuine language understanding
- **Consistent Pipeline**: Same embeddings for storage and retrieval
- **Performance**: Fast embedding generation with local models

## Testing Optimization

The system includes comprehensive test optimization strategies for RAG and knowledge integration tests:

### Performance Optimizations
- **Phi3:mini Models**: Fast inference for integration testing (10-20s vs 30+ seconds)
- **Real Embeddings**: Authentic mxbai-embed-large embeddings for genuine testing
- **Fast Mode**: Reduced context windows and document limits for CI/CD
- **Optimized Adapters**: Test-specific AI adapters with faster inference
- **Environment Controls**: Skip resource-intensive tests when infrastructure unavailable
- **Timeout Management**: Progressive timeout strategies for different test types

### Test Configuration
```bash
# Environment variables for test optimization
FAST_MODE=true              # Use minimal resources and timeouts
SKIP_OLLAMA_TESTS=true     # Skip Ollama-dependent integration tests
LOG_LEVEL=debug            # Enable detailed test logging
```

### Documentation
- **RAG Test Optimization Guide**: `docs/testing/rag-test-optimization.md`
- **Test Configuration**: `tests/integration/knowledge/test-config.ts`
- **Optimized Components**: `src/integrations/ai/OllamaRAGAdapterOptimized.ts`

## Test Infrastructure

The system now includes robust test infrastructure with comprehensive isolation and mocking strategies:

### Test Environment Isolation
- **Safe Configurations**: `jest.safe.config.js` prevents WSL terminal crashes
- **Worker Isolation**: Single worker mode with proper cleanup
- **Resource Limits**: Controlled memory and CPU usage during testing
- **Timeout Management**: Progressive timeout strategies for different test types

### Mock Strategies
- **OllamaAgent**: Manual client injection after instantiation
- **TwilioChannel**: Method-level mocking (`doInitialize`, `doSendMessage`)
- **PersonalAssistantAgent**: Manual configuration injection for userConfig
- **Import Resolution**: Fixed `.js` extension issues in TypeScript files

### Test Status
Current test results (all unit tests passing):
```
Test Suites: 8 passed, 7 skipped (integration/e2e)
Individual Tests: 102 passed, 95 skipped
Test Coverage: 100% unit test success rate
```

### Test Configurations
- **jest.config.js**: Standard configuration with isolation settings
- **jest.safe.config.js**: Maximum safety with single worker mode
- **jest.integration.config.js**: Integration test specific settings

## Web Dashboard

The system includes a comprehensive web dashboard for real-time monitoring and management of the Claudate framework:

### Dashboard Features
- **Real-time Agent Monitoring**: Live status updates, performance metrics, and control actions
- **Communication Channel Management**: Status monitoring, message flow visualization, and testing
- **Task Management**: Queue visualization, progress tracking, and analytics
- **Interactive Visualizations**: Charts, flow diagrams, and real-time updates via WebSocket
- **Responsive Design**: Mobile-optimized interface for monitoring on any device

### Dashboard Architecture
- **Backend**: Fastify REST API with 15+ endpoints (`/src/api/routes/dashboard.ts`)
- **Frontend**: Next.js 14+ with TypeScript (`/dashboard-frontend-app/`)
- **Real-time**: WebSocket integration for live updates
- **State Management**: React Query for efficient data fetching
- **Styling**: TailwindCSS with custom dashboard components

### Accessing the Dashboard
```bash
# Start backend server (includes dashboard API)
npm start

# Start frontend development server (separate terminal)
cd dashboard-frontend-app
npm run dev

# Dashboard will be available at http://localhost:3000/dashboard
```

### Dashboard Pages
- **Main Dashboard** (`/dashboard`) - System overview with key metrics
- **Agents** (`/dashboard/agents`) - Agent monitoring and management
- **Channels** (`/dashboard/channels`) - Communication channel status
- **Tasks** (`/dashboard/tasks`) - Task queue and analytics

## Development Branches

- The master local ai first branch is localai-master

## Development Commands

Since this is currently a design/planning phase repository, most commands will be established once implementation begins. The planned tech stack is Node.js/TypeScript with these anticipated commands:

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run all tests
npm run test:unit    # Run unit tests only
npm run test:e2e     # Run end-to-end tests
npm run test:integration # Run integration tests
npm run lint         # Lint TypeScript files
npm run type-check   # TypeScript type checking

# Safe Testing (Isolated Environment)
npm run test:safe    # Run tests with isolation config (recommended)
npm run test:isolated # Run tests with timeout and extra safety
npm run test:watch   # Watch mode for development

# Test Optimization (for RAG and knowledge systems)
FAST_MODE=true npm run test:integration  # Fast integration tests
SKIP_OLLAMA_TESTS=true npm test          # Skip Ollama-dependent tests

# Database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed development data
npm run db:reset     # Reset database

# Agents
npm run agents:start # Start agent workers
npm run agents:stop  # Stop agent workers
npm run agents:test  # Test agent functionality

# Ollama (Local AI)
ollama serve              # Start Ollama server
ollama pull phi3:mini     # Pull fast testing model (recommended)
ollama pull qwen3:8b      # Pull reasoning model
ollama pull mxbai-embed-large:latest  # Pull embedding model
ollama list               # List available models

# PyTorch Service (Hugging Face Models)
cd pytorch-service   # Navigate to service directory
python app.py        # Start PyTorch service
python test_service.py # Test service functionality

# Dashboard (Web Interface)
cd dashboard-frontend-app # Navigate to dashboard directory
npm run dev          # Start dashboard development server
npm run build        # Build dashboard for production
npm run lint         # Lint dashboard code

# Docker Services
docker-compose up    # Start all services (Node.js + databases)
cd pytorch-service && docker-compose up # Start PyTorch service
docker-compose down  # Stop all services
```

[The rest of the file remains unchanged]