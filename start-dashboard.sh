#!/bin/bash

# Claudate Dashboard Startup Script
# Starts both backend API and frontend dashboard simultaneously

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[DASHBOARD]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js to continue."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm to continue."
    exit 1
fi

print_status "Starting Claudate Dashboard..."

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$SCRIPT_DIR/dashboard-frontend-app"

# Check if directories exist
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    print_status "Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        print_status "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        print_status "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    print_success "Services stopped. Goodbye!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Install dependencies if needed
print_status "Checking backend dependencies..."
cd "$BACKEND_DIR"
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    print_status "Installing backend dependencies..."
    npm install
else
    print_success "Backend dependencies are up to date"
fi

print_status "Checking frontend dependencies..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install
else
    print_success "Frontend dependencies are up to date"
fi

# Create log directories
mkdir -p "$SCRIPT_DIR/logs"

# Start backend server
print_status "Starting backend server..."
cd "$BACKEND_DIR"
PORT=3001 npm start > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "Backend server failed to start. Check logs/backend.log for details."
    exit 1
fi

print_success "Backend server started (PID: $BACKEND_PID) - http://localhost:3001"

# Start frontend server
print_status "Starting frontend server..."
cd "$FRONTEND_DIR"
npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_error "Frontend server failed to start. Check logs/frontend.log for details."
    cleanup
    exit 1
fi

print_success "Frontend server started (PID: $FRONTEND_PID) - http://localhost:3000"

# Display status
echo ""
print_success "🚀 Claudate Dashboard is now running!"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  📊 Dashboard:    ${GREEN}http://localhost:3000${NC}"
echo -e "  🔧 Backend API:  ${GREEN}http://localhost:3001${NC}"
echo -e "  📊 Dashboard UI: ${GREEN}http://localhost:3000/dashboard${NC}"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  📝 Backend:  tail -f logs/backend.log"
echo -e "  📝 Frontend: tail -f logs/frontend.log"
echo ""
echo -e "${BLUE}Processes:${NC}"
echo -e "  🔧 Backend PID:  $BACKEND_PID"
echo -e "  🎨 Frontend PID: $FRONTEND_PID"
echo ""
print_warning "Press Ctrl+C to stop all services"
echo ""

# Monitor processes
while true; do
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend server stopped unexpectedly!"
        cleanup
        exit 1
    fi
    
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend server stopped unexpectedly!"
        cleanup
        exit 1
    fi
    
    sleep 5
done