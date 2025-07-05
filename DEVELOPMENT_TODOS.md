# Development TODOs - Immediate Implementation Needs

> Generated from failing tests - these are executable specifications for missing functionality

## 🚀 **HIGH PRIORITY** - Core Functionality Gaps

### 1. PersonalAssistantAgent.processMessage()

**Status**: ❌ Missing (5 tests failing)  
**File**: `src/agents/personal-assistant/PersonalAssistantAgent.ts`

```typescript
// Required method signature:
public async processMessage(
  message: BaseMessage, 
  context: AgentContext
): Promise<AgentResponse>

// Expected return format:
interface AgentResponse {
  success: boolean
  data: {
    text: string
    routingRequired: boolean
    routingTarget?: string
  }
}
```

**Requirements from tests**:
- Detect technical requests and set `routingRequired: true, routingTarget: 'claude'`
- Detect strategic requests and set `routingRequired: true, routingTarget: 'gemini'`  
- Handle urgent messages with `🚨 URGENT` formatting
- Generate executive briefs with ≤3 bullet points (lines starting with `•`)
- Format responses for mobile consumption

**Test files**: `tests/unit/agents/PersonalAssistantAgent.test.ts:84-295`

---

### 2. PersonalAssistantAgent.assignTask()

**Status**: ❌ Missing (2 tests failing)  
**File**: `src/agents/personal-assistant/PersonalAssistantAgent.ts`

```typescript
// Required method signature:
public async assignTask(task: Task): Promise<void>
```

**Requirements from tests**:
- Accept task objects with `id`, `type`, `priority`, `status`, `input`, `createdAt`
- Handle `generate_executive_brief` task type
- Handle `route_message` task type  
- Update task completion status
- Work with async task processing

**Test files**: `tests/unit/agents/PersonalAssistantAgent.test.ts:262-323`

---

### 3. Communication Preferences System

**Status**: ❌ Missing (1 test failing)  
**File**: `src/agents/personal-assistant/PersonalAssistantAgent.ts`

```typescript
// Required property:
private communicationPreferences: CommunicationPreference[]
```

**Requirements from tests**:
- Load preferences from `loadPrivateConfig()` 
- Integrate with existing mock in test (briefing style, communication hours, channels)
- Make preferences accessible for routing decisions
- Support channel preferences (SMS for urgent, Email for normal)

**Test files**: `tests/unit/agents/PersonalAssistantAgent.test.ts:387-393`

---

## 🔧 **MEDIUM PRIORITY** - Integration Features

### 4. RAG System Integration

**Status**: ❌ TypeScript compilation errors  
**Files**: Multiple in `src/knowledge/rag/`, `src/knowledge/search/`

**Missing Components**:
- `RAGSystem.setSearchEngine()` method
- `SemanticSearchEngine.setVectorStore()` method  
- `SemanticSearchEngine` constructor parameter fixes
- `RAGResponse.context` property
- `RAGContext.maxDocuments` property

**Test files**: `tests/integration/knowledge/RAGIntegration.test.ts`

---

### 5. Knowledge Store Integration

**Status**: ❌ TypeScript compilation errors  
**Files**: `src/knowledge/ingestion/`, `src/knowledge/stores/`

**Missing Components**:
- `IngestionPipeline.setStores()` method
- `CrossStoreQuery` interface export
- Proper vector store configuration
- Knowledge coordination workflows

**Test files**: `tests/integration/knowledge/KnowledgeIntegration.test.ts`

---

### 6. Agent Coordination System

**Status**: ❌ TypeScript compilation errors  
**Files**: `src/agents/coordination/`

**Missing Components**:
- Inter-agent communication protocols
- Task handoff mechanisms  
- Multi-agent workflow management
- Load balancing between agents

**Test files**: `tests/integration/agents/AgentCoordinator.test.ts`

---

## 📋 **Implementation Strategy**

### Quick Start (get to 100% test coverage)
1. **Start with PersonalAssistantAgent methods** - these have the clearest specifications
2. **Use test expectations** as your requirements document  
3. **Implement minimal working versions** first
4. **Iterate and improve** once tests pass

### Example Implementation Approach

```typescript
// Step 1: Add the method stub
public async processMessage(message: BaseMessage, context: AgentContext): Promise<AgentResponse> {
  // TODO: Implement based on test expectations
  return {
    success: true,
    data: {
      text: "Placeholder response",
      routingRequired: false
    }
  };
}

// Step 2: Run tests and see what fails
// Step 3: Implement specific behaviors to make tests pass
// Step 4: Refactor for cleaner code
```

### Test-Driven Development Flow

1. **Pick a failing test**
2. **Read the test to understand expected behavior**  
3. **Implement minimum code to make test pass**
4. **Run the specific test**: `npm test -- --testNamePattern="test name"`
5. **Verify it passes, then move to next test**

### Current Test Status
- ✅ **105/113 tests passing (93%)**
- ❌ **8 tests failing** (all documented above)
- 🎯 **Goal**: 113/113 tests passing (100%)

---

## 🔗 **Quick Reference Links**

- **Main implementation plan**: `IMPLEMENTATION.md`
- **Current status**: `IMPLEMENTATION.md#current-implementation-status`
- **Test files**: `tests/unit/` and `tests/integration/`
- **Source code**: `src/`

---

**Last Updated**: July 2025  
**Next Action**: Implement `PersonalAssistantAgent.processMessage()` method