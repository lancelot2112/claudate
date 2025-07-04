# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claudate is an agentic team framework that orchestrates specialized AI agents for collaborative software development. The system uses a three-layer architecture:

- **Personal Assistant Layer**: Primary communication interface and routing hub
- **Strategic Layer (Gemini)**: High-level planning, architecture decisions, system design
- **Execution Layer (Claude)**: Implementation, testing, debugging, and tool execution

## Development Commands

Since this is currently a design/planning phase repository, most commands will be established once implementation begins. The planned tech stack is Node.js/TypeScript with these anticipated commands:

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run all tests
npm run test:unit    # Run unit tests only
npm run test:e2e     # Run end-to-end tests
npm run lint         # Lint TypeScript files
npm run type-check   # TypeScript type checking

# Database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed development data
npm run db:reset     # Reset database

# Agents
npm run agents:start # Start agent workers
npm run agents:stop  # Stop agent workers
npm run agents:test  # Test agent functionality

# Docker
docker-compose up    # Start all services
docker-compose down  # Stop all services
```

## Architecture Overview

### Multi-Agent System Design

**Agent Types:**
- **Personal Assistant Agent** (`src/agents/personal-assistant/`): Communication hub, routing, executive summaries
- **Gemini Strategic Agents** (`src/agents/gemini/`): Planning, architecture, strategic thinking
- **Claude Execution Agents** (`src/agents/claude/`): Coding, testing, debugging, tool execution

**Core Systems:**

**Communication Layer** (`src/communication/`)
- Multi-channel support: SMS/MMS, Google Chat, Email, Voice/Video
- Content processors for different media types
- Intelligent routing based on content complexity and user preferences

**Knowledge Architecture** (`src/knowledge/`)
- **Vector Store**: Semantic search, document similarity, code repositories
- **Graph Store**: Relationships, dependencies, decision chains
- **Relational Store**: User profiles, metrics, structured data
- **RAG System**: Retrieval-augmented generation for context-aware responses

**Context Management** (`src/context/`)
- **Hot Storage (Redis)**: Current session, immediate context (last 50 messages)
- **Warm Storage (PostgreSQL)**: Recent history, user patterns (30 days)
- **Cold Storage (Vector DB)**: Long-term memory, historical insights
- **Handoff Protocol**: Seamless context transfer between agents

**Visual Generation** (`src/visual/`)
- Chart and dashboard generators for executive briefings
- Mobile-optimized output for SMS/MMS delivery
- Template system for consistent executive-level reporting

### Key Integration Points

**AI Service Integration** (`src/integrations/ai/`)
- Claude API via @anthropic-ai/sdk for execution tasks
- Gemini API via @google-ai/generativelanguage for strategic work
- Content processing: Sharp (images), FFmpeg (audio/video)

**Communication Services** (`src/integrations/communication/`)
- Twilio SDK for SMS/MMS/Voice
- Google Chat API for rich messaging and file sharing
- SendGrid for email notifications

### Configuration Management

**Private Configuration:**
- `config/private.json` - User-specific settings (git-ignored)
- Contains API keys, phone numbers, preferences
- Copy from `config/private.example.json` to set up

**Agent Configuration:**
- `config/agents.json` - Agent behavior and capabilities
- `config/communication.json` - Channel preferences and routing rules
- `config/database.json` - Database connection settings

## Development Workflow

### Agent Development
1. Extend base Agent class (`src/agents/base/Agent.ts`)
2. Implement agent-specific functionality
3. Add to agent registry and routing configuration
4. Create corresponding tests in `tests/unit/agents/`

### Communication Channel Development
1. Implement channel interface (`src/communication/channels/`)
2. Add content processor if needed (`src/communication/processors/`)
3. Update routing logic (`src/communication/Router.ts`)
4. Test with integration tests (`tests/integration/communication/`)

### Knowledge Store Integration
1. Implement storage interface (`src/knowledge/stores/`)
2. Add ingestion pipeline (`src/knowledge/ingestion/`)
3. Update retrieval system (`src/knowledge/retrieval/`)
4. Test with knowledge fixtures (`tests/fixtures/knowledge/`)

## Context Architecture

### Agent Context Flow
1. **Context Loading**: Tiered retrieval (hot → warm → cold storage)
2. **Context Processing**: Relevance scoring, compression, optimization
3. **Agent Execution**: Context-aware processing with domain knowledge
4. **Context Persistence**: Update memory stores with new insights
5. **Handoff Management**: Transfer context between agents when routing

### Executive Communication Pattern
1. **Content Analysis**: Determine complexity and urgency
2. **Channel Selection**: SMS (urgent), MMS (visual), Google Chat (detailed)
3. **Content Generation**: Executive-appropriate summaries with visual aids
4. **Delivery Optimization**: Mobile-friendly formatting, rich content support

This architecture enables sophisticated multi-agent coordination while maintaining clear separation of concerns and supporting executive-level communication requirements.