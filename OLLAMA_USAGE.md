# Ollama Service Usage Guide

## 🚀 Quick Start

The Claudate project now includes a working Ollama-based AI service that you can use immediately with local models.

### Prerequisites

1. **Ollama installed and running**:
   ```bash
   # Start Ollama server
   ollama serve
   ```

2. **Models downloaded**:
   ```bash
   # Text generation model
   ollama pull qwen3:8b
   
   # Embedding model
   ollama pull mxbai-embed-large
   
   # Alternative smaller embedding model
   ollama pull all-minilm
   ```

### 🎯 Available Commands

#### 1. Test Connection
```bash
node run-ollama-service.js test
```
Verifies Ollama is running and models are accessible.

#### 2. Run Demo
```bash
node run-ollama-service.js demo
```
Demonstrates text generation and embedding capabilities.

#### 3. Interactive Chat
```bash
node run-ollama-service.js interactive
```
Start a real-time chat session with the AI model.

### 📊 Example Output

**Text Generation Demo:**
```
🤖 Generating text with qwen3:8b...
Prompt: Write a simple hello world function in JavaScript
Response: Here's a simple "Hello, world!" function in JavaScript:

```javascript
function helloWorld() {
  console.log("Hello, world!");
}
```
```

**Embedding Generation Demo:**
```
🔢 Generating embedding with mxbai-embed-large...
Text: Hello, this is a test sentence for embedding.
Embedding dimensions: 1024
First 5 values: [0.464, 0.103, 0.104, 0.044, -0.378]
```

### ⚙️ Configuration

The service can be configured via environment variables:

```bash
# Ollama server settings
export OLLAMA_HOST=localhost
export OLLAMA_PORT=11434

# Model selection
export OLLAMA_DEFAULT_MODEL=qwen3:8b
export OLLAMA_EMBEDDING_MODEL=mxbai-embed-large
```

### 🔧 Programmatic Usage

You can also use the service programmatically:

```javascript
const { OllamaService } = require('./run-ollama-service.js');

async function example() {
  const service = new OllamaService();
  await service.initialize();
  
  // Generate text
  const response = await service.generateText('Explain async/await in JavaScript');
  console.log(response);
  
  // Generate embedding
  const embedding = await service.generateEmbedding('Sample text for embedding');
  console.log('Embedding dimensions:', embedding.length);
}
```

### 🎨 Available Models

#### Text Generation Models
- **qwen3:8b** - Code-focused model (recommended)
- **llama3.2:3b** - General purpose (smaller, faster)
- **llama3.1:8b** - General purpose (balanced)

#### Embedding Models  
- **mxbai-embed-large** - High quality embeddings (1024 dims)
- **all-minilm** - Fast, compact embeddings (384 dims)
- **nomic-embed-text** - Alternative quality option

### 🚀 Performance Tips

1. **Model Size vs Speed**: Larger models (8B) provide better quality but are slower
2. **GPU Acceleration**: Ollama automatically uses GPU if available
3. **Model Caching**: First request loads model, subsequent requests are faster
4. **Memory Usage**: Keep models loaded by making regular requests

### 🔍 Troubleshooting

#### Connection Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# Start Ollama if needed
ollama serve
```

#### Missing Models
```bash
# List available models
ollama list

# Pull missing models
ollama pull qwen3:8b
ollama pull mxbai-embed-large
```

#### Port Conflicts
```bash
# Use different port
export OLLAMA_PORT=11435
ollama serve --port 11435
```

### 🎯 Integration with Claudate

This Ollama service integrates seamlessly with the Claudate agent system:

1. **Personal Assistant Agent**: Uses Ollama for local AI processing
2. **RAG System**: Leverages embedding models for document search
3. **Code Generation**: Utilizes code-focused models for development tasks
4. **Privacy**: All processing happens locally - no external API calls

### 📈 Next Steps

Once you're comfortable with the Ollama service:

1. **Explore Phase 6**: Advanced features and agent coordination
2. **Custom Models**: Train or fine-tune models for specific tasks  
3. **Production Deployment**: Scale with Docker and load balancing
4. **Integration**: Connect with external tools and databases

---

**Status**: ✅ Production Ready  
**Models**: Local-first with privacy guarantees  
**Performance**: Optimized for development workflows  
**Support**: Full Claudate ecosystem integration