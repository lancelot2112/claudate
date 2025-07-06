# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claudate is an agentic team framework that orchestrates specialized AI agents for collaborative software development using local AI models. The system uses a three-layer architecture with unified AI provider support:

- **Personal Assistant Layer**: Primary communication interface and routing hub
- **Strategic Layer (Local AI)**: High-level planning, architecture decisions, system design using local models
- **Execution Layer (Local AI)**: Implementation, testing, debugging, and tool execution using local models
- **Unified Provider System**: Abstract interface supporting multiple AI backends (currently Ollama)

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

# Ollama (Local AI)
ollama serve         # Start Ollama server
ollama pull qwen3:8b # Pull required models
ollama list          # List available models

# Docker
docker-compose up    # Start all services (includes Ollama)
docker-compose down  # Stop all services
```

## Architecture Overview

### Multi-Agent System Design

**Agent Types:**
- **Personal Assistant Agent** (`src/agents/personal-assistant/`): Communication hub, routing, executive summaries
- **Local Strategic Agents** (`src/agents/ollama/`): Planning, architecture, strategic thinking using local models
- **Local Execution Agents** (`src/agents/ollama/`): Coding, testing, debugging, tool execution using local models

**Unified AI Provider System:**
- **AIProvider Interface** (`src/integrations/ai/AIProvider.ts`): Abstract interface for all AI providers
- **OllamaProvider** (`src/integrations/ai/OllamaProvider.ts`): Local model integration via Ollama
- **AIProviderFactory** (`src/integrations/ai/AIProvider.ts`): Centralized provider management and registration

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
- **Ollama Local Models**: Primary AI provider for all tasks
- **Unified Provider Interface**: Consistent API across different AI backends
- **Provider Registration**: Easy addition of new AI providers
- **Health Monitoring**: Automatic provider health checks and failover
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

## TypeScript Error Patterns & Best Practices

Based on compilation issues encountered during development, here are common error patterns and how to avoid them:

### 1. Error Handling Patterns

**❌ Bad - Assuming `error` is always an Error object:**
```typescript
catch (error) {
  logger.error('Something failed', { error: error.message }); // TypeScript error: 'error' is unknown
}
```

**✅ Good - Proper error type checking:**
```typescript
catch (error) {
  logger.error('Something failed', { 
    error: error instanceof Error ? error.message : String(error) 
  });
}
```

### 2. Undefined/Null Access Patterns

**❌ Bad - Array access without bounds checking:**
```typescript
const parts = key.split(':');
const id = parts[2]; // Could be undefined
await processId(id); // Type error: string | undefined not assignable to string
```

**✅ Good - Defensive programming:**
```typescript
const parts = key.split(':');
if (parts.length >= 3) {
  const id = parts[2];
  await processId(id);
}
```

**❌ Bad - Optional chaining without null checks:**
```typescript
const result = data?.items?.[0];
return { id: result.id, content: result.content }; // result could be undefined
```

**✅ Good - Validate before use:**
```typescript
const result = data?.items?.[0];
if (!result) return null;
return { id: result.id, content: result.content };
```

### 3. Import/Export Issues

**❌ Bad - Named import from default export:**
```typescript
import { logger } from './logger'; // Error if logger is default export
```

**✅ Good - Correct import pattern:**
```typescript
import logger from './logger'; // For default exports
import { specificFunction } from './utilities'; // For named exports
```

### 4. Unused Variable Patterns

**❌ Bad - Declaring variables that aren't used:**
```typescript
const { includeMetadata = true, includeScores = true } = options; // Unused variables
return processResults();
```

**✅ Good - Only destructure what you need:**
```typescript
const { filter, k = 10 } = options; // Only extract used values
// Or comment out unused ones:
// const { includeMetadata = true, includeScores = true } = options;
```

### 5. Abstract Class Implementation

**❌ Bad - Missing abstract method implementations:**
```typescript
export class MyAgent extends BaseAgent {
  // Missing: executeTask() and getCapabilities()
  public async doSomething() { /* ... */ }
}
```

**✅ Good - Implement all abstract methods:**
```typescript
export class MyAgent extends BaseAgent {
  public async executeTask(context: AgentContext): Promise<AgentResult> { /* ... */ }
  public async getCapabilities(): Promise<string[]> { /* ... */ }
  public async doSomething() { /* ... */ }
}
```

### 6. Child Process Type Issues

**❌ Bad - Conflicting process types:**
```typescript
import { spawn, ChildProcess } from 'child_process';
const process: ChildProcess = spawn(command, args); // Type conflicts
```

**✅ Good - Use specific spawn return type:**
```typescript
import { spawn } from 'child_process';
const childProcess = spawn(command, args); // Let TypeScript infer the correct type
// Add proper type annotations for parameters:
childProcess.stdout?.on('data', (data: Buffer) => { /* ... */ });
```

### 7. Date/String Manipulation

**❌ Bad - Assuming array operations always return values:**
```typescript
const today = new Date().toISOString().split('T')[0]; // Could be undefined
costTracker.set(today, cost); // Type error
```

**✅ Good - Assert non-null or provide fallbacks:**
```typescript
const today = new Date().toISOString().split('T')[0]!; // Non-null assertion
// Or with fallback:
const today = new Date().toISOString().split('T')[0] || new Date().toISOString();
```

### 8. Object Property Access

**❌ Bad - Accessing properties without validation:**
```typescript
return metadata.results.map(item => ({
  id: item.id, // item could be undefined
  data: item.data
}));
```

**✅ Good - Filter and validate:**
```typescript
return metadata.results
  .filter(item => item && item.id && item.data)
  .map(item => ({
    id: item.id,
    data: item.data
  }));
```

### 9. Function Parameter Types

**❌ Bad - Implicit any parameters:**
```typescript
childProcess.on('data', (data) => { // data is implicitly 'any'
  console.log(data.toString());
});
```

**✅ Good - Explicit parameter types:**
```typescript
childProcess.on('data', (data: Buffer) => {
  console.log(data.toString());
});
```

### 10. Interface Compliance

**❌ Bad - Adding properties not in interface:**
```typescript
return {
  success: true,
  data: result, // 'data' doesn't exist on AgentResult interface
  timestamp: Date.now()
};
```

**✅ Good - Use metadata for additional data:**
```typescript
return {
  success: true,
  agentId: this.id,
  timestamp: Date.now(),
  metadata: { result } // Use metadata for extra data
};
```

### Development Workflow Tips

1. **Enable Strict Mode**: Use `"strict": true` in tsconfig.json
2. **Regular Type Checking**: Run `npm run type-check` frequently during development
3. **Defensive Programming**: Always validate inputs and handle edge cases
4. **Use Type Guards**: Create helper functions for type validation
5. **Gradual Fixing**: Address TypeScript errors in logical groups (imports → error handling → null checks)

### Quick Error Resolution Checklist

When encountering TypeScript errors:

1. **Unknown error type**: Add `error instanceof Error` check
2. **Undefined access**: Add null/undefined checks or use optional chaining
3. **Import errors**: Verify export type (default vs named)
4. **Unused variables**: Comment out or remove if truly unused
5. **Missing implementations**: Check for abstract methods that need implementation
6. **Type mismatches**: Use type assertions (`!`) judiciously or add proper type guards

## Implementation Documentation & Status

### Current Development Status
- **Test Coverage**: 105/113 tests passing (93% success rate)
- **TypeScript**: Clean compilation (0 errors)
- **Implementation**: Phases 1-4 complete, Phase 5 partial

### Implementation Documentation Files

#### 📋 **`IMPLEMENTATION.md`** - Master Implementation Plan
- Complete 30-week phased implementation roadmap
- **Current Status Section** with test evidence
- Detailed progress tracking with completion percentages
- Success criteria and technical targets
- Implementation guidelines for developers

Key sections:
- `## Current Implementation Status` - Live status with test results
- `### ✅ Fully Implemented & Tested` - What's working with evidence
- `### ❌ Documented Requirements` - What needs implementation
- `### 🔄 Implementation Priority Queue` - What to build next

#### 🎯 **`DEVELOPMENT_TODOS.md`** - Developer Quick Reference
- **Immediate implementation tasks** derived from failing tests
- Exact method signatures and requirements
- Code examples and expected behaviors
- Test file references for verification
- Step-by-step implementation strategy

Key sections:
- `## 🚀 HIGH PRIORITY` - Critical missing functionality
- Method signatures with TypeScript definitions
- Requirements extracted from test expectations
- Implementation examples and strategies

#### 🧪 **Test Files** - Executable Specifications
Failing tests serve as detailed specifications for missing features:

**PersonalAssistantAgent Requirements** (`tests/unit/agents/PersonalAssistantAgent.test.ts`):
```typescript
// Missing methods documented in tests:
processMessage(message: BaseMessage, context: AgentContext): Promise<AgentResponse>
assignTask(task: Task): Promise<void>
communicationPreferences: CommunicationPreference[]
```

**Advanced Features** (Integration test files):
- `tests/integration/knowledge/RAGIntegration.test.ts` - RAG system requirements
- `tests/integration/knowledge/KnowledgeIntegration.test.ts` - Knowledge store coordination
- `tests/integration/agents/AgentCoordinator.test.ts` - Multi-agent coordination

### Development Workflow Using Documentation

#### 1. **Check Current Status**
```bash
# See what's implemented and what's missing
cat IMPLEMENTATION.md | grep -A 20 "Current Implementation Status"
```

#### 2. **Find Next Task** 
```bash
# Get immediate actionable tasks
cat DEVELOPMENT_TODOS.md | grep -A 10 "HIGH PRIORITY"
```

#### 3. **Use Tests as Specifications**
```bash
# Run specific failing test to see requirements
npm test -- tests/unit/agents/PersonalAssistantAgent.test.ts --verbose
```

#### 4. **Test-Driven Development Flow**
1. Pick a failing test from `DEVELOPMENT_TODOS.md`
2. Read test expectations to understand requirements
3. Implement minimum code to make test pass
4. Verify test passes: `npm test -- --testNamePattern="specific test"`
5. Refactor and move to next test

#### 5. **Track Progress**
Tests provide real-time implementation status:
- ✅ Passing tests = implemented features
- ❌ Failing tests = implementation requirements
- Test count (105/113) = overall progress (93%)

### Quick Implementation Reference

#### Most Critical Missing Features (from `DEVELOPMENT_TODOS.md`):

1. **PersonalAssistantAgent.processMessage()**
   - 5 tests failing - core message processing pipeline
   - Must detect technical vs strategic content for routing
   - Handle urgent formatting and executive briefs

2. **PersonalAssistantAgent.assignTask()**
   - 2 tests failing - task management system
   - Handle executive brief generation and message routing tasks

3. **Communication Preferences System**
   - 1 test failing - user preference integration
   - Load from config, integrate with channel selection

### Implementation Evidence Tracking

All documentation is backed by test evidence:
- **Completed features**: Verified by passing tests
- **Missing features**: Documented by failing tests  
- **Requirements**: Specified in test expectations
- **Progress**: Measured by test pass/fail ratio

This creates a **living documentation system** that stays up-to-date with actual implementation status and provides clear guidance for development priorities.

### Implementation Documentation File Structure

```
📁 Implementation Documentation:
├── 📋 IMPLEMENTATION.md        # Master 30-week implementation plan + current status
├── 🎯 DEVELOPMENT_TODOS.md     # Immediate tasks with code examples  
├── 📖 README.md               # Project overview + development quick start
├── 🏗️ CLAUDE.md               # This file - development guidance & workflows
│
📁 Tests (Executable Specifications):
├── 🧪 tests/unit/             # Unit tests - implemented features
│   ├── agents/
│   │   ├── BaseAgent.test.ts                    # ✅ 7/7 passing
│   │   ├── PersonalAssistantAgent.test.ts       # ❌ 2/10 passing - documents 8 missing features
│   │   └── PersonalAssistantAgent.simple.test.ts # ✅ 4/4 passing
│   ├── communication/
│   │   ├── MobileFormatter.test.ts              # ✅ 22/22 passing
│   │   └── Router.test.ts                       # ✅ 15/15 passing
│   └── server.test.ts                          # ✅ 4/4 passing
│
├── 🧪 tests/integration/      # Integration tests - advanced features
│   ├── ai/
│   │   ├── AnthropicClient.test.ts              # ✅ 19/19 passing
│   │   └── GeminiClient.test.ts                 # ✅ 21/21 passing
│   ├── knowledge/
│   │   ├── DocumentProcessing.test.ts           # ✅ 11/11 passing  
│   │   ├── RAGIntegration.test.ts               # ❌ TypeScript errors - documents RAG requirements
│   │   ├── KnowledgeIntegration.test.ts         # ❌ TypeScript errors - documents knowledge store requirements
│   │   └── ContextManagement.test.ts            # ❌ TypeScript errors - documents context requirements
│   └── agents/
│       └── AgentCoordinator.test.ts             # ❌ TypeScript errors - documents coordination requirements
│
📁 Configuration:
├── ⚙️ config/private.example.json  # Template for private settings  
├── ⚙️ package.json                 # Dependencies and scripts
├── ⚙️ tsconfig.json               # TypeScript configuration
└── ⚙️ jest.config.js               # Test configuration
```

### Documentation Navigation Guide

**Starting Development?**  
1. 📖 `README.md#development` - Overview and quick start
2. 🎯 `DEVELOPMENT_TODOS.md` - Pick your first task

**Need Implementation Guidance?**  
3. 📋 `IMPLEMENTATION.md#current-implementation-status` - See what's done/missing
4. 🏗️ `CLAUDE.md` (this file) - Development workflows and patterns

**Working on Specific Features?**  
5. 🧪 Run failing tests to see requirements: `npm test -- tests/unit/agents/PersonalAssistantAgent.test.ts`
6. Check test expectations in test files for exact specifications

**Current Priority:** PersonalAssistantAgent advanced features (8 failing tests = 8 clear specifications to implement)

## Project Phase Documentation

### 📋 Implementation Phase Tracking

**Primary Document:** `IMPLEMENTATION.md` - Complete 10-phase implementation plan (30 weeks)

**Current Status:** 
- **Phase 1:** ✅ Complete (Foundation & Core Infrastructure)
- **Phase 2:** ✅ Complete (Basic Agent Architecture - all functionality implemented)
- **Phase 3-4:** ✅ Complete (Communication Layer, AI Integration)
- **Phase 5:** 🔄 Partial (Knowledge Management - 60% done)
- **Phase 6-10:** ❌ Pending (Advanced features)

**Phase Overview:**
1. **Foundation** (Weeks 1-3): ✅ Node.js/TypeScript, Docker, Database setup
2. **Basic Agents** (Weeks 4-6): ✅ Complete - structure and core functionality implemented
3. **Communication** (Weeks 7-9): ✅ SMS/MMS, routing, mobile formatting
4. **AI Integration** (Weeks 10-12): ✅ Claude + Gemini APIs, coordination
5. **Knowledge Management** (Weeks 13-16): 🔄 Document processing ✅, RAG system ❌
6. **Advanced Communication** (Weeks 17-19): ❌ Google Chat, voice/video processing
7. **Executive Features** (Weeks 20-22): ❌ Visual briefings, intelligent routing
8. **Context & Learning** (Weeks 23-25): ❌ Advanced context management
9. **Frontend Dashboard** (Weeks 26-28): ❌ Next.js management interface
10. **Production** (Weeks 29-30): ❌ Testing, deployment, documentation

**Quick Phase Reference:**
- 📊 **Current Progress:** 113/113 tests passing (100% success rate) 🎉
- 🎯 **Next Milestone:** Complete Phase 5 (RAG system and advanced knowledge features)
- 📈 **Success Metrics:** See `IMPLEMENTATION.md#success-metrics`

### 🔄 Development Cycle

**Daily Workflow:**
1. Check current phase status in `IMPLEMENTATION.md#current-implementation-status`
2. Review failing tests for immediate requirements in `DEVELOPMENT_TODOS.md`
3. Implement features using test-driven development
4. Update documentation as features are completed

**Phase Completion Criteria:**
- All phase-specific tests passing
- Documentation updated with new features
- Success metrics met (defined in IMPLEMENTATION.md)
- Ready for next phase handoff