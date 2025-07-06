# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claudate is an agentic team framework that orchestrates specialized AI agents for collaborative software development using local AI models. The system uses a three-layer architecture with unified AI provider support:

- **Personal Assistant Layer**: Primary communication interface and routing hub
- **Strategic Layer (Local AI)**: High-level planning, architecture decisions, system design using local models
- **Execution Layer (Local AI)**: Implementation, testing, debugging, and tool execution using local models
- **Unified Provider System**: Abstract interface supporting multiple AI backends (currently Ollama)

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

[The rest of the file remains unchanged]