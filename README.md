# Claudate

An agentic team framework that orchestrates specialized AI agents for collaborative software development and problem-solving, powered by local AI models for privacy, reliability, and cost-effectiveness.

## Overview

Claudate creates an efficient multi-agent system using local AI models through Ollama:

- **Local AI Agents**: Handle all AI operations using locally-hosted models
- **Unified Architecture**: Consistent interface for adding different AI providers
- **Privacy-First**: All processing happens locally with no external API calls

## Goals

- Leverage local AI models for complete data privacy and control
- Create seamless handoffs between agents based on task requirements  
- Build a framework that can tackle complex, multi-faceted projects
- Provide extensible architecture for adding new AI providers
- Eliminate external dependencies and usage-based costs

## Architecture

The framework coordinates local AI agents to work together on projects:

- **Personal Assistant Layer**: Primary interface for all communications and routing
- **Strategic Layer (Local Models)**: Project planning, requirement analysis, system design
- **Execution Layer (Local Models)**: Implementation, testing, debugging, tooling
- **Unified Provider System**: Abstract interface supporting multiple AI backends

## User Interface

### Personal Assistant Agent
The primary interface for all communications, acting as your dedicated personal assistant:

#### Core Functions
- **Communication Hub**: Single point of contact for all incoming and outgoing messages
- **Intelligent Routing**: Analyzes content and routes to appropriate specialist agents
- **Executive Summaries**: Distills complex technical updates into concise, actionable insights
- **Priority Management**: Filters communications based on urgency and importance
- **Context Awareness**: Maintains conversation history and project context

#### Communication Channels
**Incoming:**
- **SMS/Text**: Plain text commands, requests, and instructions
- **MMS**: Images for analysis, screenshots for debugging, diagrams for planning
- **RCS**: Rich content with formatted messages, quick replies, and file attachments
- **Voice Messages**: Audio instructions converted to text and processed
- **Video Content**: Screen recordings, demonstrations, or visual explanations
- **Google Chat**: Rich messaging for detailed conversations and file sharing

**Outgoing:**
- **Executive Briefs**: "Project X: 80% complete, 2 blockers identified, ETA tomorrow 3pm"
- **Visual Status Reports**: Charts, graphs, and diagrams to illustrate project progress
- **Critical Alerts**: Immediate notifications for urgent issues requiring attention
- **Daily Summaries**: End-of-day progress reports with key metrics and visual dashboards
- **Detailed Reports**: Comprehensive briefings via Google Chat with rich formatting
- **Smart Responses**: Contextual quick replies and status confirmations

#### Content Processing Pipeline
1. **Receive**: Accept all forms of multimedia communication
2. **Parse**: Extract text, analyze images, transcribe audio/video
3. **Classify**: Determine urgency, complexity, and appropriate agent type
4. **Route**: Direct to Gemini (strategy) or Claude (execution) agents
5. **Synthesize**: Compile responses into executive-appropriate summaries
6. **Deliver**: Send concise, actionable updates via preferred channel

### Private Configuration
Personal settings are kept local and secure:

- **`config/private.json`**: User-specific settings (phone numbers, API keys, preferences)
- **Git-ignored**: Private configuration never committed to version control
- **Template Provided**: `config/private.example.json` for easy setup
- **Multi-user Support**: Each user maintains their own private configuration

### Configuration Setup
1. Copy `config/private.example.json` to `config/private.json`
2. Add your phone number, notification preferences, and API credentials
3. Configure agent priorities and update frequency
4. Set up PyTorch service: `cd pytorch-service && cp .env.example .env`
5. The framework handles the rest automatically

## Technology Stack

### Local-First AI Architecture

**Core Framework:**
- **Backend**: Node.js + TypeScript + Fastify
- **Frontend**: Next.js + React + TailwindCSS
- **Database**: PostgreSQL + Redis (caching/sessions)
- **Queue System**: Bull/BullMQ for agent task processing

**Local AI Integration:**
- **Ollama**: Local LLM hosting and management (GGML optimized)
- **PyTorch Service**: Direct Hugging Face model access via Python microservice
- **Supported Models**: Qwen3:8b, Qwen2.5-Coder, DeepSeek-Coder, CodeLlama, Llama3.2, DialoGPT, CodeBERT
- **Embeddings**: all-minilm, sentence-transformers, BGE, nomic-embed-text, custom HF models
- **Unified Provider System**: Abstract interface supporting multiple AI backends

**Communication Services:**
- **SMS/MMS/Voice**: Twilio SDK
- **Google Chat**: Google Chat API for rich messaging and file sharing
- **Email Notifications**: SendGrid
- **Real-time Updates**: WebSockets for agent coordination

**Content Processing:**
- **Images**: Sharp for image processing
- **Audio/Video**: FFmpeg for multimedia content
- **Visual Generation**: Chart.js, D3.js for data visualization

**Development & Deployment:**
- **Containerization**: Docker with Ollama and PyTorch service integration
- **Self-Hosting**: Complete local deployment capability
- **Monitoring**: Real-time dashboard with agent and model status
- **Security**: JWT authentication, encrypted private configs
- **Microservices**: Python FastAPI service for PyTorch models

### Why Local-First?

1. **Privacy**: All AI processing happens locally - no data leaves your infrastructure
2. **Cost Control**: No usage-based pricing or API rate limits
3. **Reliability**: No external API dependencies or network failures
4. **Customization**: Full control over model selection and fine-tuning
5. **Extensibility**: Easy to add new local or cloud providers via unified interface
6. **Offline Capability**: Works without internet connectivity

## AI Provider Architecture

### Unified Provider System

Claudate uses a unified AI provider interface that abstracts away specific AI implementations:

```typescript
// Easy to switch or add providers
const provider = await AIProviderFactory.create('ollama', {
  host: 'localhost',
  port: 11434,
  defaultModel: 'qwen3:8b'
});

// Consistent interface across all providers
const response = await provider.generateText({
  messages: [{ role: 'user', content: 'Hello world' }],
  temperature: 0.7
});
```

### Currently Supported

- **OllamaProvider**: Local model hosting via Ollama
  - Models: Qwen3:8b, DeepSeek-Coder, CodeLlama, Llama3.2
  - Embeddings: all-minilm, nomic-embed-text
  - Features: Text generation, embeddings, health monitoring

- **PyTorchProvider**: Direct Hugging Face model access via Python service
  - Models: Any HF model (Qwen2.5-Coder, DialoGPT, CodeBERT, etc.)
  - Embeddings: sentence-transformers, BGE, custom models
  - Features: Advanced model management, GPU acceleration, model caching
  - Architecture: FastAPI microservice with HTTP communication

### Future Extensibility

The architecture supports easy addition of new providers:

```typescript
// Adding a new provider is simple
class OpenAIProvider extends BaseAIProvider {
  async generateText(request) { /* implementation */ }
  async generateEmbedding(request) { /* implementation */ }
}

// Register and use
AIProviderFactory.register('openai', OpenAIProvider);
```

### Provider Features

- **Health Monitoring**: Automatic health checks and metrics
- **Failover Support**: Automatic fallback between providers
- **Consistent Interfaces**: Same API regardless of underlying provider
- **Configuration Management**: Centralized provider configuration

## Knowledge Architecture

### Multi-Layered Knowledge System

Claudate uses a sophisticated knowledge architecture to provide agents with domain-specific expertise:

**Layer 1: Agent Memory (Redis)**
- Session context and conversation history
- Recent decisions and learned patterns
- Agent-specific preferences and configurations

**Layer 2: Domain Knowledge (Vector Database)**
- Code repositories and documentation
- Project-specific knowledge bases
- Industry standards and best practices
- API documentation and examples

**Layer 3: Relationship Knowledge (Graph Database)**
- Project dependencies and connections
- Team member expertise and roles
- Historical decision patterns
- Cross-project learnings

**Layer 4: Structured Data (PostgreSQL)**
- User profiles and permissions
- Agent performance metrics
- Audit logs and compliance data
- Configuration and settings

### Knowledge Integration Patterns

**RAG (Retrieval-Augmented Generation):**
- Agents query relevant knowledge before responding
- Context-aware responses based on historical data
- Semantic search across documentation and code

**Knowledge Graphs for Complex Queries:**
- Discover relationships between concepts
- Track dependencies and decision chains
- Enable sophisticated reasoning about projects

**Multi-Agent Knowledge Sharing:**
- Agents contribute learnings to shared knowledge base
- Cross-pollination of insights between domains
- Organizational memory that persists across sessions

### Agent-Specific Knowledge Stores

**Personal Assistant Agent:**
- User communication patterns and preferences
- Meeting schedules and priority frameworks
- Historical decision context
- Visual briefing templates and chart preferences
- Executive dashboard layouts and KPI visualizations

**Local Strategic Agents:**
- Industry knowledge and market trends
- Architectural patterns and design principles
- Project management methodologies

**Local Execution Agents:**
- Code repositories and documentation
- API references and examples
- Testing frameworks and debugging patterns
- DevOps and deployment knowledge

### Knowledge Ingestion Pipeline

- **Document Upload**: Automatic chunking and vectorization
- **Code Repository Scanning**: Continuous indexing of codebases
- **Meeting Transcripts**: Decision logs and action items
- **External API Documentation**: Import and maintain current references

## Agent Context Management

### Context Layers for Individual Agents

Claudate maintains sophisticated context for each agent to ensure optimal performance and continuity:

**Agent Identity Context:**
- Role definition and capabilities
- Communication style and personality
- Expertise domains and constraints
- Behavioral patterns and preferences

**Session Context:**
- Current conversation history
- Active tasks and projects
- User-specific preferences
- Working memory state

**Working Memory Context:**
- Recent decisions and actions
- Short-term learnings and patterns
- Current focus and priorities
- Pending tasks and reminders

### Context Persistence Strategy

**Tiered Storage System:**

**Hot Storage (Redis) - Immediate Access:**
- Current session context (last 50 messages)
- Active working memory and agent state
- Real-time decision tracking
- Pending actions and responses

**Warm Storage (PostgreSQL) - Recent History:**
- Session summaries (last 30 days)
- User interaction patterns and preferences
- Agent performance metrics
- Medium-term learnings and adaptations

**Cold Storage (Vector DB) - Long-term Memory:**
- Historical conversations (summarized)
- Domain expertise accumulated over time
- Cross-project learnings and insights
- Archived decision patterns and outcomes

### Inter-Agent Context Sharing

**Shared Context Pool:**
- Project-wide objectives and constraints
- Key decisions and their rationale
- Stakeholder preferences and requirements
- Cross-agent insights and recommendations

**Context Handoff Protocol:**
- Seamless context transfer between agents
- Formatted context specific to receiving agent
- Preserved user preferences and patterns
- Task-specific background information

### Context Optimization

**Contextual Compression:**
- Intelligent summarization of historical data
- Pattern extraction from conversation history
- Semantic preservation with reduced token usage
- Relevance-based filtering and prioritization

**Proactive Context Loading:**
- Predictive context retrieval based on user patterns
- Pre-cached frequently accessed information
- Anticipatory loading of likely-needed context
- Performance optimization for real-time interactions

**User-Specific Adaptation:**
- Learning from user feedback and corrections
- Adapting communication style over time
- Maintaining consistency across agent interactions
- Personalizing responses based on historical preferences

### Example: Personal Assistant Agent Context

```typescript
const personalAssistantContext = {
  identity: {
    role: "Executive Personal Assistant",
    communicationStyle: "executive",
    verbosity: "brief",
    expertise: ["scheduling", "prioritization", "communication-filtering"]
  },
  userProfile: {
    preferences: {
      briefingStyle: "bullet-points-max-3",
      urgencyThreshold: "high",
      communicationHours: "6am-10pm EST",
      responseTime: "immediate-for-critical"
    }
  },
  currentContext: {
    activeProjects: ["project-alpha", "board-meeting-prep"],
    upcomingDeadlines: [/* recent deadlines */],
    recentDecisions: [/* decision history */],
    communicationPatterns: {
      prefersAMSummaries: true,
      avoidInterruptionsDuringFocus: true,
      valuesProactiveProblemSolving: true
    }
  }
};
```

## Visual Executive Briefings

### Enhanced Communication with Visual Context

The Personal Assistant Agent can generate and send visual content to provide clearer, more impactful executive briefings:

**Visual Briefing Types:**

**Progress Dashboards:**
- Project completion percentages with visual progress bars
- Timeline charts showing milestones and deadlines
- Resource allocation and team utilization graphs
- Budget tracking and burn rate visualizations

**Status Reports with Charts:**
- Gantt charts for project timelines
- Pie charts for resource distribution
- Bar graphs for performance metrics
- Trend lines for key performance indicators

**Problem Visualization:**
- Flowcharts showing blockers and dependencies
- Network diagrams for system architecture issues
- Process maps highlighting bottlenecks
- Risk matrices with priority quadrants

**Decision Support Graphics:**
- Option comparison tables with visual scoring
- Cost-benefit analysis charts
- ROI projections and scenario planning
- Competitive landscape positioning maps

### Visual Generation Pipeline

**Automated Chart Generation:**
```typescript
const visualBriefing = await personalAssistant.generateVisualBriefing({
  projectData: currentProjects,
  chartTypes: ['progress', 'timeline', 'risks'],
  style: 'executive', // Clean, professional styling
  format: 'png', // Optimized for mobile viewing
  annotations: true // Key insights highlighted
});
```

**Smart Visual Selection:**
- Analyzes data complexity to choose optimal chart type
- Considers user's visual preferences and past engagement
- Adapts to mobile screen constraints for SMS/MMS delivery
- Includes concise annotations for key insights

**Example Visual Brief:**
"📊 Project Alpha Update: [Attached: progress_chart.png] 
• 80% complete (green trend)
• 2 blockers identified (see red indicators)
• ETA: Tomorrow 3pm
• Budget: 5% under target"

### Integration with Communication Channels

**MMS-Optimized Images:**
- Compressed for fast delivery while maintaining clarity
- Mobile-friendly dimensions and readable text
- High contrast for various lighting conditions
- Annotated with key callouts and insights

**Rich Content Support:**
- Multiple images in sequence for complex briefings
- Combined text + visual messages for context
- Interactive elements for RCS-enabled devices
- Fallback text summaries for SMS-only recipients

## Multi-Channel Communication Strategy

### Intelligent Channel Selection

The Personal Assistant Agent automatically selects the optimal communication channel based on content complexity and user preferences:

**SMS/Text (160 chars):**
- Critical alerts and immediate notifications
- Simple status updates and confirmations
- Quick yes/no questions and responses

**MMS (Visual + Text):**
- Executive briefs with supporting charts
- Progress updates with visual dashboards
- Problem identification with diagrams

**Google Chat (Rich Format):**
- Detailed project reports and analysis
- Multi-topic briefings with sections and headers
- File attachments and document sharing
- Interactive cards with action buttons
- Threaded conversations for complex topics

### Google Chat Integration Features

**Rich Message Formatting:**
- Structured cards with project information
- Interactive buttons for quick responses
- File attachments for documents and reports
- Threaded conversations for organized discussions

**Advanced Briefing Capabilities:**
```typescript
const detailedBriefing = await personalAssistant.sendGoogleChatBriefing({
  recipient: 'ceo@company.com',
  content: {
    header: 'Weekly Executive Summary',
    sections: [
      { title: 'Project Status', content: projectSummary, chart: progressChart },
      { title: 'Key Decisions Required', content: decisionsNeeded, priority: 'high' },
      { title: 'Resource Allocation', content: resourceUpdate, attachments: [budgetReport] }
    ],
    actions: [
      { text: 'Approve Budget', action: 'approve_budget' },
      { text: 'Schedule Review', action: 'schedule_meeting' }
    ]
  }
});
```

**Smart Message Threading:**
- Group related updates into conversation threads
- Maintain context across multiple exchanges
- Reference previous decisions and outcomes
- Enable follow-up questions and clarifications

**Communication Preferences:**
- User-configurable channel preferences by message type
- Time-based routing (SMS for urgent, Chat for detailed)
- Fallback options when primary channels are unavailable
- Cross-channel context preservation

## Project Structure

### Clean Repository Organization

```
claudate/
├── 📋 Documentation & Guides
│   ├── README.md                    # Project overview & getting started
│   ├── IMPLEMENTATION.md            # 30-week implementation roadmap
│   ├── CLAUDE.md                   # Development guidance for Claude Code
│   ├── DEVELOPMENT_TODOS.md        # Current development priorities
│   └── LICENSE                     # MIT license
│
├── ⚙️ Configuration & Setup
│   ├── package.json                # Dependencies and scripts
│   ├── tsconfig.json              # TypeScript configuration
│   ├── docker-compose.yml         # Multi-service Docker setup
│   ├── Dockerfile                 # Production container
│   ├── .gitignore                 # Git ignore patterns (inc. test-*.js)
│   ├── .env.example               # Environment template
│   ├── jest.config.js             # Unit test configuration
│   ├── jest.integration.config.js # Integration test configuration
│   └── nodemon.json               # Development server config
│
├── 🗂️ Source Code
│   ├── src/
│   │   ├── agents/                # AI agent implementations
│   │   │   ├── base/              # Base agent classes
│   │   │   ├── personal-assistant/ # Primary communication interface
│   │   │   ├── gemini/            # Strategic planning agents  
│   │   │   ├── claude/            # Execution & coding agents
│   │   │   └── ollama/            # Generic Ollama agents (supports any model)
│   │   │
│   │   ├── communication/         # Multi-channel communication
│   │   │   ├── channels/          # SMS, MMS, Google Chat
│   │   │   ├── formatters/        # Mobile-optimized formatting
│   │   │   ├── processors/        # Content processing
│   │   │   └── router/            # Intelligent routing
│   │   │
│   │   ├── knowledge/             # RAG & knowledge management
│   │   │   ├── stores/            # Vector, Graph, Relational stores
│   │   │   ├── search/            # Semantic search engine
│   │   │   ├── rag/               # RAG system implementation
│   │   │   ├── ingestion/         # Document processing pipeline
│   │   │   ├── context/           # Context management
│   │   │   └── coordination/      # Cross-store coordination
│   │   │
│   │   ├── integrations/          # External service integrations
│   │   │   ├── ai/                # Ollama, PyTorch provider clients
│   │   │   ├── communication/     # Twilio, Google services
│   │   │   └── storage/           # Database connectors
│   │   │
│   │   ├── context/               # Advanced context management
│   │   │   ├── managers/          # Session & handoff management
│   │   │   ├── storage/           # Hot/Warm/Cold storage tiers
│   │   │   └── compression/       # Context optimization
│   │   │
│   │   ├── visual/                # Executive briefing generation
│   │   │   ├── charts/            # Chart generation
│   │   │   ├── generators/        # Visual content creation
│   │   │   ├── templates/         # Executive templates
│   │   │   └── optimizers/        # Mobile optimization
│   │   │
│   │   ├── api/                   # REST API layer
│   │   ├── database/              # Database models & migrations
│   │   ├── queue/                 # Background job processing
│   │   ├── utils/                 # Shared utilities
│   │   ├── types/                 # TypeScript type definitions
│   │   └── server.ts              # Main application entry
│   │
│   ├── tests/                     # Comprehensive test suite
│   │   ├── unit/                  # Unit tests (115+ passing)
│   │   ├── integration/           # Integration tests (with real DBs)
│   │   ├── e2e/                   # End-to-end tests
│   │   ├── fixtures/              # Test data
│   │   └── setup/                 # Test configuration
│   │
│   └── examples/                  # Usage examples & demos
│       ├── dual-cli-rag.ts        # RAG with local AI
│       └── rag-with-cli.ts        # CLI integration examples
│
├── 🔧 Infrastructure & Tools
│   ├── pytorch-service/           # Python PyTorch microservice
│   │   ├── app.py                 # FastAPI application
│   │   ├── model_manager.py       # Model management system
│   │   ├── requirements.txt       # Python dependencies
│   │   ├── Dockerfile            # Container configuration
│   │   └── docker-compose.yml    # Service orchestration
│   │
│   ├── scripts/                   # Setup & deployment scripts
│   │   ├── setup-dev-db.sh        # Development database setup
│   │   ├── setup-test-db.js       # Test database configuration
│   │   ├── setup/                 # Installation scripts
│   │   ├── migration/             # Database migrations
│   │   └── deployment/            # Production deployment
│   │
│   ├── docs/                      # Technical documentation
│   │   ├── DATABASE_SETUP_DEV.md  # Database setup guide
│   │   ├── agents/                # Agent architecture docs
│   │   ├── api/                   # API documentation
│   │   └── architecture/          # System architecture
│   │
│   ├── config/                    # Configuration templates
│   │   └── private.example.json   # Private config template
│   │
│   └── docker/                    # Docker configurations
│       ├── backend/               # Backend container setup
│       ├── frontend/              # Frontend container (future)
│       └── database/              # Database initialization
│
├── 🐳 Development Environment
│   ├── logs/                      # Application logs (git-ignored)
│   ├── dist/                      # Compiled output (git-ignored)
│   ├── node_modules/              # Dependencies (git-ignored)
│   └── .env                       # Local environment (git-ignored)
│
└── ✨ Clean Development
    ├── .gitignore patterns prevent test-*.js, debug-*.js clutter
    ├── Proper separation of infrastructure vs temporary files
    ├── Professional repository structure for code reviews
    └── Clear developer onboarding experience
```

### Architecture Design Principles

**Agent-Centric Organization:**
- Each agent type (Personal Assistant, Gemini Strategic, Claude Execution) has dedicated directories
- Base agent classes provide common functionality and interfaces
- Clear separation between strategic planning and tactical execution

**Communication Layer Separation:**
- Channel-specific implementations for SMS, MMS, Google Chat, Email
- Content processors for different media types (text, image, voice, video)
- Intelligent routing logic for optimal channel selection

**Knowledge Management:**
- Separate storage implementations for vector, graph, and relational data
- Ingestion pipelines for documents, code repositories, and conversations
- Retrieval systems supporting RAG and semantic search

**Context Management:**
- Tiered storage architecture (hot/warm/cold) for different data access patterns
- Session and agent handoff management
- Context compression and optimization for token efficiency

**Visual Generation:**
- Chart and dashboard generators for executive briefings
- Template system for consistent visual styling
- Mobile-optimized output for SMS/MMS delivery

---

## 🛠️ Development

### Current Status
- **Test Coverage**: 105/113 tests passing (93% success rate)
- **TypeScript**: Clean compilation (0 errors)
- **Implementation**: Phases 1-4 complete, Phase 5 partial

### Quick Start for Developers
1. **Check current status**: See `IMPLEMENTATION.md#current-implementation-status`
2. **Find what to build next**: See `DEVELOPMENT_TODOS.md`
3. **Run tests**: `npm test` (for specific tests: `npm test -- tests/unit/specific.test.ts`)
4. **Follow TDD**: Use failing tests as specifications for missing features

### Key Development Files
- 📋 **`IMPLEMENTATION.md`** - Complete implementation plan and current status
- 🎯 **`DEVELOPMENT_TODOS.md`** - Immediate tasks with code examples
- 🧪 **`tests/`** - Failing tests serve as feature specifications
- 🏗️ **`CLAUDE.md`** - Development commands and workflow guide

### Implementation Priority
1. **PersonalAssistantAgent.processMessage()** - Core message processing
2. **PersonalAssistantAgent.assignTask()** - Task management system
3. **Communication preferences** - User preference integration
4. **RAG system integration** - Advanced knowledge features
5. **Agent coordination** - Multi-agent workflows

Tests provide executable specifications for all missing functionality.