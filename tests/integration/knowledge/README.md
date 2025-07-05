# Knowledge Management Integration Tests

This directory contains comprehensive integration tests for the Claudate knowledge management system, covering all major components and their interactions.

## Test Structure

### Core Test Files

- **`KnowledgeIntegration.test.ts`** - Main integration tests covering the complete knowledge management workflow
- **`DocumentProcessing.test.ts`** - Tests for document ingestion, processing, and chunking
- **`ContextManagement.test.ts`** - Tests for tiered context storage, compression, and retrieval
- **`RAGIntegration.test.ts`** - Tests for Retrieval-Augmented Generation functionality

### Test Coverage

The integration tests cover:

1. **Document Ingestion Pipeline**
   - Multi-format document processing (text, PDF, code, JSON)
   - Document chunking and metadata extraction
   - Batch ingestion workflows

2. **Vector Store Operations**
   - Semantic search and similarity matching
   - Document embedding and retrieval
   - Collection management and statistics

3. **Relational Store Operations**
   - Full-text search capabilities
   - Document filtering and categorization
   - Database performance and scalability

4. **Graph Store Operations**
   - Node and relationship management
   - Path finding and graph traversal
   - Graph querying and analytics

5. **RAG System**
   - Context-aware question answering
   - Conversation history maintenance
   - Multi-source information synthesis

6. **Context Management**
   - Tiered storage (hot/warm/cold)
   - Context compression and summarization
   - Automatic migration policies

7. **Cross-Store Coordination**
   - Multi-store query coordination
   - Result merging strategies
   - Intelligent search routing

## Prerequisites

### Required Services

The integration tests require the following services to be running:

1. **PostgreSQL Database**
   - Host: `localhost` (default) or `TEST_DB_HOST`
   - Port: `5432` (default) or `TEST_DB_PORT`
   - Database: `claudate_test` or `TEST_DB_NAME`
   - User: `test` or `TEST_DB_USER`
   - Password: `test` or `TEST_DB_PASSWORD`

2. **Redis Server**
   - URL: `redis://localhost:6379/1` (default) or `TEST_REDIS_URL`

3. **ChromaDB Vector Database**
   - URL: `http://localhost:8000` (default) or `TEST_CHROMA_URL`

### API Keys

For full functionality, set the following environment variables:

```bash
export OPENAI_API_KEY="your-openai-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export GEMINI_API_KEY="your-gemini-api-key"
```

**Note:** Tests will run with mock/test keys if real API keys are not provided, but some functionality will be limited.

## Setup Instructions

### 1. Database Setup

Create a test PostgreSQL database:

```sql
CREATE DATABASE claudate_test;
CREATE USER test WITH PASSWORD 'test';
GRANT ALL PRIVILEGES ON DATABASE claudate_test TO test;
```

### 2. Redis Setup

Start Redis server (using Docker):

```bash
docker run -d -p 6379:6379 redis:alpine
```

### 3. ChromaDB Setup

Start ChromaDB server:

```bash
# Using Docker
docker run -d -p 8000:8000 chromadb/chroma

# Or using pip
pip install chromadb
chroma run --host localhost --port 8000
```

### 4. Environment Configuration

Create a `.env.test` file:

```bash
# Database
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=claudate_test
TEST_DB_USER=test
TEST_DB_PASSWORD=test

# Redis
TEST_REDIS_URL=redis://localhost:6379/1

# Vector Database
TEST_CHROMA_URL=http://localhost:8000

# AI APIs (optional for full testing)
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
GEMINI_API_KEY=your-key-here
```

## Running Tests

### All Knowledge Integration Tests

```bash
npm run test:integration:knowledge
```

### Individual Test Files

```bash
# Main integration workflow
npm test tests/integration/knowledge/KnowledgeIntegration.test.ts

# Document processing
npm test tests/integration/knowledge/DocumentProcessing.test.ts

# Context management
npm test tests/integration/knowledge/ContextManagement.test.ts

# RAG system
npm test tests/integration/knowledge/RAGIntegration.test.ts
```

### With Coverage

```bash
npm run test:integration:knowledge -- --coverage
```

### Debugging

```bash
# Run with verbose output
npm test tests/integration/knowledge/ -- --verbose

# Run specific test
npm test tests/integration/knowledge/KnowledgeIntegration.test.ts -- --testNamePattern="should perform cross-store queries"
```

## Test Data

The tests use predefined test documents covering AI, machine learning, and data science topics. This ensures consistent and meaningful test scenarios while avoiding external dependencies.

### Sample Documents

- AI and Machine Learning Overview
- Database Design Principles
- Software Architecture Patterns
- Neural Networks and Deep Learning
- Data Science Workflow

## Performance Expectations

### Response Time Targets

- Vector search: < 2 seconds
- Context storage/retrieval: < 1 second
- RAG question answering: < 30 seconds
- Cross-store queries: < 5 seconds

### Concurrency Testing

Tests verify system behavior under concurrent load with multiple simultaneous operations.

## Error Handling

The tests extensively cover error scenarios:

- Missing documents
- Invalid queries
- Service unavailability
- Network timeouts
- Invalid data formats

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify PostgreSQL is running
   - Check database credentials
   - Ensure test database exists

2. **Redis Connection Errors**
   - Verify Redis server is running
   - Check Redis URL configuration
   - Ensure test database (1) is accessible

3. **Vector Database Errors**
   - Verify ChromaDB is running
   - Check ChromaDB URL
   - Ensure sufficient memory/disk space

4. **API Key Errors**
   - Verify API keys are valid
   - Check rate limits
   - Ensure sufficient credits/quota

### Debug Mode

Enable debug logging:

```bash
DEBUG=knowledge:* npm test tests/integration/knowledge/
```

### Test Isolation

Each test file cleans up its data to prevent interference. If tests fail due to data conflicts, run:

```bash
# Clean test databases
npm run test:clean
```

## Contributing

When adding new integration tests:

1. Follow the existing test structure
2. Include proper setup and cleanup
3. Test both success and error scenarios
4. Document any new prerequisites
5. Ensure tests are deterministic

### Test Categories

- **Functionality Tests**: Core feature validation
- **Performance Tests**: Response time and throughput
- **Error Handling Tests**: Graceful failure scenarios
- **Integration Tests**: Component interaction verification
- **End-to-End Tests**: Complete workflow validation

## Monitoring

The tests include built-in monitoring for:

- Query performance metrics
- Memory usage patterns
- Database connection health
- API response times
- Error rates and patterns

This ensures the knowledge management system maintains high performance and reliability standards.