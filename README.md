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

**Outgoing:**
- **Executive Briefs**: "Project X: 80% complete, 2 blockers identified, ETA tomorrow 3pm"
- **Critical Alerts**: Immediate notifications for urgent issues requiring attention
- **Daily Summaries**: End-of-day progress reports with key metrics
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