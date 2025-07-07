# Development Database Setup Guide

This guide covers setting up the three-tier knowledge architecture for Claudate development:

1. **Vector Store (ChromaDB)** - Semantic search, document similarity
2. **Relational Store (PostgreSQL)** - User profiles, metrics, structured data  
3. **Graph Store (In-Memory/Neo4j)** - Relationships, dependencies, decision chains

Plus context management tiers:
- **Hot Storage (Redis)** - Current session, immediate context
- **Warm Storage (PostgreSQL)** - Recent history, user patterns
- **Cold Storage (Vector DB)** - Long-term memory, historical insights

## Quick Start (Recommended)

### Option 1: Docker Compose (Full Setup)
```bash
# Clone and start all services
git clone <repo>
cd claudate
docker-compose up -d

# Check services are running
docker-compose ps
```

### Option 2: Local Development (Minimal Setup)
```bash
# Start just the databases
docker-compose up -d postgres redis chroma

# Set environment variables
cp .env.example .env
# Edit .env with your settings
```

### Option 3: CLI-Only Setup (No External DBs)
```bash
# Use our in-memory alternatives for development
npm run dev:local
# This uses mock stores with CLI integration
```

---

## Detailed Setup Instructions

### 1. Vector Store - ChromaDB Setup

**Purpose**: Semantic search, document embeddings, similarity matching

#### Docker Setup (Recommended)
```bash
# Via docker-compose
docker-compose up -d chroma

# Or standalone
docker run -d \
  --name claudate-chroma \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  -e CHROMA_HOST=0.0.0.0 \
  -e CHROMA_PORT=8000 \
  ghcr.io/chroma-core/chroma:latest
```

#### Manual Installation
```bash
# Install ChromaDB
pip install chromadb

# Start server
chroma run --host 0.0.0.0 --port 8000
```

#### Configuration
```bash
# Environment variables
export CHROMA_URL=http://localhost:8000
export CHROMA_HOST=localhost
export CHROMA_PORT=8000
```

#### Test Connection
```bash
# Test ChromaDB is working
curl http://localhost:8000/api/v1/heartbeat

# Should return: {"nanosecond heartbeat": <timestamp>}
```

---

### 2. Relational Store - PostgreSQL Setup

**Purpose**: User profiles, metrics, structured data, session history

#### Docker Setup (Recommended)
```bash
# Via docker-compose
docker-compose up -d postgres

# Or standalone
docker run -d \
  --name claudate-postgres \
  -e POSTGRES_USER=claudate \
  -e POSTGRES_PASSWORD=claudate_dev_password \
  -e POSTGRES_DB=claudate \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

#### Manual Installation (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create user and database
sudo -u postgres psql
CREATE USER claudate WITH PASSWORD 'claudate_dev_password';
CREATE DATABASE claudate OWNER claudate;
GRANT ALL PRIVILEGES ON DATABASE claudate TO claudate;
\\q
```

#### Configuration
```bash
# Environment variables
export DATABASE_URL=postgresql://claudate:claudate_dev_password@localhost:5432/claudate
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
export DATABASE_NAME=claudate
export DATABASE_USER=claudate
export DATABASE_PASSWORD=claudate_dev_password
```

#### Database Schema
```bash
# Run migrations (when available)
npm run db:migrate

# Or manually create tables
psql $DATABASE_URL -f docker/database/init.sql
```

#### Test Connection
```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# Should show PostgreSQL version info
```

---

### 3. Graph Store - In-Memory/Neo4j Setup

**Purpose**: Relationships, dependencies, decision chains

#### Option A: In-Memory (Development)
```typescript
// Already configured in code - no setup needed
const graphStore = new GraphStore({
  persistToDisk: false,
  maxNodes: 1000,
  maxRelationships: 5000
});
```

#### Option B: Neo4j (Production-like)
```bash
# Docker setup
docker run -d \
  --name claudate-neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/claudate_neo4j_password \
  -v neo4j_data:/data \
  neo4j:latest

# Access web interface
open http://localhost:7474
```

#### Configuration for Neo4j
```bash
# Environment variables
export NEO4J_URL=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=claudate_neo4j_password
```

---

### 4. Hot Storage - Redis Setup

**Purpose**: Current session, immediate context (last 50 messages)

#### Docker Setup (Recommended)
```bash
# Via docker-compose
docker-compose up -d redis

# Or standalone
docker run -d \
  --name claudate-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes --requirepass claudate_redis_password
```

#### Manual Installation
```bash
# Install Redis (Ubuntu/Debian)
sudo apt update
sudo apt install redis-server

# Configure password
echo "requirepass claudate_redis_password" | sudo tee -a /etc/redis/redis.conf

# Start service
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### Configuration
```bash
# Environment variables
export REDIS_URL=redis://:claudate_redis_password@localhost:6379
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=claudate_redis_password
```

#### Test Connection
```bash
# Test Redis connection
redis-cli -a claudate_redis_password ping

# Should return: PONG
```

---

## Complete Environment Configuration

### .env File Setup
```bash
# Copy example and edit
cp .env.example .env
```

### Required Environment Variables
```bash
# Database connections
DATABASE_URL=postgresql://claudate:claudate_dev_password@localhost:5432/claudate
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=claudate
DATABASE_USER=claudate
DATABASE_PASSWORD=claudate_dev_password

# Redis configuration
REDIS_URL=redis://:claudate_redis_password@localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=claudate_redis_password

# Vector database
CHROMA_URL=http://localhost:8000
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=your-jwt-secret-for-development
ENCRYPTION_KEY=your-32-character-encryption-key

# AI APIs (optional with CLI integration)
ANTHROPIC_API_KEY=sk-ant-your-key-here    # Optional if using Claude CLI
GEMINI_API_KEY=your-gemini-key-here       # Optional if using Gemini CLI
OPENAI_API_KEY=sk-your-openai-key-here    # For embeddings (or use CLI)
```

---

## Development Workflow

### 1. Start All Services
```bash
# Full development environment
docker-compose up -d

# Check all services are healthy
docker-compose ps
curl http://localhost:8000/api/v1/heartbeat  # ChromaDB
curl http://localhost:3000/health           # API (if running)
redis-cli -a claudate_redis_password ping   # Redis
psql $DATABASE_URL -c "SELECT 1;"          # PostgreSQL
```

### 2. Initialize Data
```bash
# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Test knowledge ingestion
npm run test:knowledge
```

### 3. Verify Integration
```bash
# Test the three-tier architecture
npm test -- tests/integration/knowledge/

# Test Ollama integration (local models)
node run-ollama-service.js test

# Test full RAG pipeline with Ollama (using Qwen3 model as example)
npm test -- tests/integration/knowledge/RAGIntegration.ollama.qwen3.test.ts

# Test context compression system
npm test -- tests/unit/knowledge/ContextCompressor.test.ts

# Run context compression example
npx ts-node examples/context-compression-example.ts
```

---

## Development Options by Complexity

### Level 1: Minimal (CLI Only)
**No external services needed**
- ✅ Uses Claude CLI for AI
- ✅ In-memory stores for testing
- ✅ Perfect for development/testing

```bash
# Just install and authenticate Claude CLI
claude auth login
node test-direct-cli-rag.js
```

### Level 2: Local Databases
**Local database services**
- ✅ Full database functionality
- ✅ Persistent storage
- ✅ Real performance testing

```bash
docker-compose up -d postgres redis chroma
npm run dev
```

### Level 3: Full Production-Like
**All services + external APIs**
- ✅ Production-identical setup
- ✅ Full feature testing
- ✅ Performance benchmarking

```bash
# Set all API keys in .env
docker-compose up -d
npm run dev:full
```

---

## Troubleshooting

### Common Issues

#### ChromaDB Connection Failed
```bash
# Check if service is running
docker logs claudate-chroma

# Restart if needed
docker-compose restart chroma
```

#### PostgreSQL Connection Refused
```bash
# Check service status
docker logs claudate-postgres

# Verify credentials
psql postgresql://claudate:claudate_dev_password@localhost:5432/claudate
```

#### Redis Authentication Failed
```bash
# Test without password first
redis-cli ping

# Then with password
redis-cli -a claudate_redis_password ping
```

### Performance Optimization

#### ChromaDB
```bash
# Increase memory for better performance
docker run -d \
  --name claudate-chroma \
  --memory=2g \
  -p 8000:8000 \
  ghcr.io/chroma-core/chroma:latest
```

#### PostgreSQL
```bash
# Tune for development
echo "shared_buffers = 256MB" >> postgresql.conf
echo "work_mem = 16MB" >> postgresql.conf
```

#### Redis
```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## Data Management

### Backup Development Data
```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > claudate_dev_backup.sql

# Redis backup
redis-cli -a claudate_redis_password BGSAVE

# ChromaDB data (Docker volumes)
docker run --rm -v claudate_chroma_data:/data -v $(pwd):/backup alpine tar czf /backup/chroma_backup.tar.gz -C /data .
```

### Reset Development Environment
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: Deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
npm run db:migrate
npm run db:seed
```

---

## Context Compression Integration

The system includes an intelligent context compression system for efficient memory management:

### Setup
Context compression works with any development level and requires minimal additional setup:

```bash
# Context compression is automatically available with any Ollama setup
# Configuration is managed via src/config/prompts.json

# Test the compression system
npm test -- tests/unit/knowledge/ContextCompressor.test.ts

# See practical example
npx ts-node examples/context-compression-example.ts
```

### Key Features
- **Model-Aware**: Automatically respects context window limits for different models
- **Configurable**: Customize compression behavior via JSON configuration
- **Intelligent Fallbacks**: Semantic compression with statistical backup
- **Performance Optimized**: Chunked processing for large content

### Usage with Database Tiers
Context compression integrates seamlessly with the three-tier architecture:

- **Hot Storage (Redis)**: Compressed current session context
- **Warm Storage (PostgreSQL)**: Compressed conversation summaries  
- **Cold Storage (Vector DB)**: Compressed historical insights

### Configuration Example
```json
{
  "compressor": {
    "systemPrompt": "Specialized context compressor for development logs",
    "compressionPrompt": "Compress debug logs preserving error patterns: {content}",
    "parameters": {
      "defaultTemperature": 0.2,
      "targetCompressionRatio": 0.3
    }
  }
}
```

---

## Next Steps

1. **Choose your development level** (1, 2, or 3 above)
2. **Run the setup commands** for your chosen level
3. **Test the integration** with our CLI-based tests
4. **Configure context compression** for your specific use case
5. **Start developing** with full three-tier knowledge architecture

The CLI integration means you can start with Level 1 (minimal setup) and scale up to Level 3 as needed, without being blocked by external service requirements!