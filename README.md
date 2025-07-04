# Claudate

An agentic team framework that orchestrates specialized AI agents for collaborative software development and problem-solving.

## Overview

Claudate combines the strengths of different AI models to create an efficient multi-agent system:

- **Gemini Agents**: Handle high-level planning, architecture decisions, and strategic thinking
- **Claude Agents**: Focus on coding, testing, debugging, and tool execution tasks

## Goals

- Leverage paid subscriptions to Gemini and Claude for optimal performance
- Create seamless handoffs between agents based on task requirements
- Build a framework that can tackle complex, multi-faceted projects
- Provide clear separation of concerns between strategic and tactical work

## Architecture

The framework will coordinate agents to work together on projects, with each agent type handling tasks that align with their strengths:

- **Personal Assistant Layer**: Primary interface for all communications and routing
- **Strategic Layer (Gemini)**: Project planning, requirement analysis, system design
- **Execution Layer (Claude)**: Implementation, testing, debugging, tooling

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
4. The framework handles the rest automatically

## Technology Stack

### Recommended: Node.js/TypeScript Full Stack

**Core Framework:**
- **Backend**: Node.js + TypeScript + Fastify
- **Frontend**: Next.js + React + TailwindCSS
- **Database**: PostgreSQL + Redis (caching/sessions)
- **Queue System**: Bull/BullMQ for agent task processing

**AI Integration:**
- **Claude API**: @anthropic-ai/sdk for coding and execution tasks
- **Gemini API**: @google-ai/generativelanguage for strategic planning
- **Content Processing**: Sharp (images), FFmpeg (audio/video)
- **Visual Generation**: Chart.js, D3.js for data visualization, DALL-E/Midjourney for concept illustrations

**Communication Services:**
- **SMS/MMS/Voice**: Twilio SDK
- **Google Chat**: Google Chat API for rich messaging and file sharing
- **Email Notifications**: SendGrid
- **Real-time Updates**: WebSockets for agent coordination

**Development & Deployment:**
- **Containerization**: Docker
- **Hosting**: Railway/Vercel for rapid deployment
- **Monitoring**: Real-time dashboard with agent status
- **Security**: JWT authentication, encrypted private configs

### Why This Stack?

1. **AI-First Development**: Excellent SDK support for Claude and Gemini APIs
2. **Communication Excellence**: Twilio's Node.js SDK is mature and feature-complete  
3. **Rapid Iteration**: TypeScript provides safety while maintaining flexibility
4. **Unified Codebase**: Same language reduces context switching between components
5. **Executive Dashboard**: Next.js provides real-time capabilities for monitoring
6. **Scalable Architecture**: Built for enterprise multi-agent coordination

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

**Gemini Strategic Agents:**
- Industry knowledge and market trends
- Architectural patterns and design principles
- Project management methodologies

**Claude Execution Agents:**
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

### Recommended Folder Organization

```
claudate/
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile
├── .gitignore
├── .env.example
│
├── config/
│   ├── private.example.json
│   ├── agents.json
│   ├── database.json
│   └── communication.json
│
├── src/
│   ├── agents/
│   │   ├── base/
│   │   │   ├── Agent.ts
│   │   │   ├── Context.ts
│   │   │   └── Memory.ts
│   │   ├── personal-assistant/
│   │   │   ├── PersonalAssistantAgent.ts
│   │   │   ├── VisualBriefing.ts
│   │   │   └── ChannelRouter.ts
│   │   ├── gemini/
│   │   │   ├── StrategicAgent.ts
│   │   │   └── PlanningAgent.ts
│   │   └── claude/
│   │       ├── CodingAgent.ts
│   │       ├── TestingAgent.ts
│   │       └── ToolExecutionAgent.ts
│   │
│   ├── communication/
│   │   ├── channels/
│   │   │   ├── SMS.ts
│   │   │   ├── MMS.ts
│   │   │   ├── GoogleChat.ts
│   │   │   └── Email.ts
│   │   ├── processors/
│   │   │   ├── TextProcessor.ts
│   │   │   ├── ImageProcessor.ts
│   │   │   ├── VoiceProcessor.ts
│   │   │   └── VideoProcessor.ts
│   │   └── Router.ts
│   │
│   ├── knowledge/
│   │   ├── stores/
│   │   │   ├── VectorStore.ts
│   │   │   ├── GraphStore.ts
│   │   │   └── RelationalStore.ts
│   │   ├── ingestion/
│   │   │   ├── DocumentIngestion.ts
│   │   │   ├── CodeIngestion.ts
│   │   │   └── ConversationIngestion.ts
│   │   └── retrieval/
│   │       ├── RAG.ts
│   │       ├── SemanticSearch.ts
│   │       └── ContextBuilder.ts
│   │
│   ├── context/
│   │   ├── managers/
│   │   │   ├── ContextManager.ts
│   │   │   ├── SessionManager.ts
│   │   │   └── HandoffManager.ts
│   │   ├── storage/
│   │   │   ├── HotStorage.ts (Redis)
│   │   │   ├── WarmStorage.ts (PostgreSQL)
│   │   │   └── ColdStorage.ts (Vector DB)
│   │   └── compression/
│   │       ├── Summarizer.ts
│   │       └── Optimizer.ts
│   │
│   ├── visual/
│   │   ├── generators/
│   │   │   ├── ChartGenerator.ts
│   │   │   ├── DashboardGenerator.ts
│   │   │   └── DiagramGenerator.ts
│   │   ├── templates/
│   │   │   ├── ExecutiveTemplates.ts
│   │   │   └── StatusTemplates.ts
│   │   └── optimizers/
│   │       ├── MobileOptimizer.ts
│   │       └── CompressionOptimizer.ts
│   │
│   ├── api/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── controllers/
│   │
│   ├── database/
│   │   ├── models/
│   │   ├── migrations/
│   │   └── seeds/
│   │
│   ├── queue/
│   │   ├── workers/
│   │   └── jobs/
│   │
│   ├── integrations/
│   │   ├── ai/
│   │   ├── communication/
│   │   └── storage/
│   │
│   ├── utils/
│   ├── types/
│   └── server.ts
│
├── frontend/
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   └── styles/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── scripts/
│   ├── setup/
│   ├── migration/
│   └── deployment/
│
├── docs/
│   ├── api/
│   ├── agents/
│   └── architecture/
│
└── docker/
    ├── backend/
    ├── frontend/
    └── database/
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