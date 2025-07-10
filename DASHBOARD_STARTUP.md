# Claudate Dashboard Startup Guide

This guide shows you how to start the complete Claudate Dashboard system with both backend and frontend servers.

## Quick Start

### Option 1: Using the Startup Script (Recommended)

**Linux/macOS:**
```bash
./start-dashboard.sh
```

**Windows:**
```cmd
start-dashboard.bat
```

**Using npm:**
```bash
npm run dashboard
```

### Option 2: Manual Startup

**Terminal 1 - Backend Server:**
```bash
npm start
```

**Terminal 2 - Frontend Server:**
```bash
cd dashboard-frontend-app
npm run dev
```

### Option 3: Using Concurrently (Development)

```bash
npm run dashboard:dev
```

## What Gets Started

The startup script launches:

1. **Backend API Server** (`http://localhost:3001`)
   - REST API endpoints for dashboard data
   - WebSocket support for real-time updates
   - Agent management and monitoring
   - Task queue management

2. **Frontend Dashboard** (`http://localhost:3000`)
   - Next.js React application
   - Real-time dashboard interface
   - Agent monitoring and control
   - Task management interface

## Dashboard Pages

Once running, access these dashboard pages:

- **Main Dashboard**: `http://localhost:3000/dashboard`
- **Agents**: `http://localhost:3000/dashboard/agents`
- **Channels**: `http://localhost:3000/dashboard/channels`
- **Tasks**: `http://localhost:3000/dashboard/tasks`

## Features

### Real-Time Agent Monitoring
- Live agent status and health metrics
- Performance charts and CPU/memory usage
- Agent control actions (start/stop/restart)
- Task history and logs

### Communication Channel Monitoring
- Channel status and connection health
- Message flow visualization
- Channel testing and diagnostics
- Real-time message routing diagrams

### Task Management & Progress Tracking
- Task queue visualization with priorities
- Progress monitoring and analytics
- Task filtering and bulk actions
- Performance insights and recommendations

## Logs

The startup script creates log files in the `logs/` directory:

- `logs/backend.log` - Backend server logs
- `logs/frontend.log` - Frontend build and runtime logs

Monitor logs in real-time:
```bash
# Backend logs
tail -f logs/backend.log

# Frontend logs  
tail -f logs/frontend.log
```

## Stopping the Services

- **Startup Script**: Press `Ctrl+C` to stop both services
- **Manual**: Stop each terminal process individually
- **Process Management**: The script tracks PIDs and cleans up properly

## Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- All dependencies installed (`npm install` in both root and dashboard-frontend-app)

## Troubleshooting

**Port conflicts:**
- Backend uses port 3001
- Frontend uses port 3000
- Ensure these ports are available

**Dependency issues:**
```bash
# Install all dependencies
npm run dashboard:install
```

**Build issues:**
```bash
# Clean build both projects
npm run clean
npm run dashboard:build
```

**Permission issues (Linux/macOS):**
```bash
chmod +x start-dashboard.sh
```

## Development

For development with hot reloading:
```bash
npm run dashboard:dev
```

This uses concurrently to run both servers with auto-restart on file changes.

## Production

To build for production:
```bash
npm run dashboard:build
```

Then start with:
```bash
npm start  # Backend
# Frontend build files served from dashboard-frontend-app/out/
```