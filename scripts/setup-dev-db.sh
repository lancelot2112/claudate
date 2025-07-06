#!/bin/bash

# Claudate Development Database Setup Script
# Sets up the three-tier knowledge architecture for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

echo -e "${BLUE}🚀 Claudate Development Database Setup${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
port_available() {
    ! nc -z localhost $1 2>/dev/null
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists docker; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command_exists docker-compose; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Check if required ports are available
echo -e "\n🔍 Checking port availability..."

PORTS=(5432 6379 8000)
PORT_NAMES=("PostgreSQL" "Redis" "ChromaDB")
PORTS_BLOCKED=()

for i in "${!PORTS[@]}"; do
    PORT=${PORTS[$i]}
    NAME=${PORT_NAMES[$i]}
    
    if port_available $PORT; then
        print_status "Port $PORT ($NAME) is available"
    else
        print_warning "Port $PORT ($NAME) is in use"
        PORTS_BLOCKED+=("$PORT ($NAME)")
    fi
done

if [ ${#PORTS_BLOCKED[@]} -gt 0 ]; then
    print_warning "Some ports are in use. You may need to stop existing services:"
    for port in "${PORTS_BLOCKED[@]}"; do
        echo "  - $port"
    done
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Setup environment file
echo -e "\n📝 Setting up environment configuration..."

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        print_status "Created .env file from .env.example"
    else
        print_info "Creating basic .env file..."
        cat > "$ENV_FILE" << EOF
# Claudate Development Environment
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://claudate:claudate_dev_password@localhost:5432/claudate
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=claudate
DATABASE_USER=claudate
DATABASE_PASSWORD=claudate_dev_password

# Redis Configuration  
REDIS_URL=redis://:claudate_redis_password@localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=claudate_redis_password

# Vector Database Configuration
CHROMA_URL=http://localhost:8000
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Security
JWT_SECRET=dev-jwt-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-32-chars-long

# AI APIs (Optional - CLI integration available)
# ANTHROPIC_API_KEY=sk-ant-your-key-here
# GEMINI_API_KEY=your-gemini-key-here  
# OPENAI_API_KEY=sk-your-openai-key-here

# Communication (Optional for development)
# TWILIO_ACCOUNT_SID=your-twilio-sid
# TWILIO_AUTH_TOKEN=your-twilio-token
# TWILIO_PHONE_NUMBER=your-twilio-number
EOF
        print_status "Created basic .env file"
    fi
else
    print_status ".env file already exists"
fi

# Prompt for setup level
echo -e "\n🎚️  Choose your development setup level:"
echo "  1) Minimal (CLI only, no external services)"
echo "  2) Local databases (PostgreSQL, Redis, ChromaDB)"
echo "  3) Full setup (all services including API backend)"
echo ""
read -p "Enter your choice (1-3): " -n 1 -r SETUP_LEVEL
echo -e "\n"

case $SETUP_LEVEL in
    1)
        echo -e "\n🔧 Setting up Level 1: Minimal (CLI only)..."
        print_info "This setup uses in-memory stores and CLI integration"
        print_info "Perfect for development and testing without external dependencies"
        
        # Check if Claude CLI is available
        if command_exists claude; then
            print_status "Claude CLI is available"
            
            # Test Claude CLI
            if claude "Please respond with just 'OK'" | grep -q "OK"; then
                print_status "Claude CLI is working correctly"
            else
                print_warning "Claude CLI authentication may be needed: claude auth login"
            fi
        else
            print_warning "Claude CLI not found. Install from: https://github.com/anthropics/claude-code"
        fi
        
        print_status "Level 1 setup complete!"
        print_info "You can now run: node test-direct-cli-rag.js"
        ;;
        
    2)
        echo -e "\n🔧 Setting up Level 2: Local databases..."
        print_info "Starting PostgreSQL, Redis, and ChromaDB services"
        
        # Start database services only
        docker-compose up -d postgres redis chroma
        
        echo -e "\n⏳ Waiting for services to be ready..."
        sleep 10
        
        # Check service health
        print_info "Checking service health..."
        
        # Check PostgreSQL
        if docker-compose exec -T postgres pg_isready -U claudate >/dev/null 2>&1; then
            print_status "PostgreSQL is ready"
        else
            print_warning "PostgreSQL may still be starting up"
        fi
        
        # Check Redis  
        if docker-compose exec -T redis redis-cli -a claudate_redis_password ping | grep -q "PONG"; then
            print_status "Redis is ready"
        else
            print_warning "Redis may still be starting up"
        fi
        
        # Check ChromaDB
        if curl -s http://localhost:8000/api/v1/heartbeat >/dev/null 2>&1; then
            print_status "ChromaDB is ready"
        else
            print_warning "ChromaDB may still be starting up"
        fi
        
        print_status "Level 2 setup complete!"
        print_info "Services are starting up. You can check status with: docker-compose ps"
        ;;
        
    3)
        echo -e "\n🔧 Setting up Level 3: Full setup..."
        print_info "Starting all services including API backend"
        
        # Start all services
        docker-compose up -d
        
        echo -e "\n⏳ Waiting for all services to be ready..."
        sleep 15
        
        print_info "Checking all services..."
        docker-compose ps
        
        print_status "Level 3 setup complete!"
        print_info "All services are starting. Check logs with: docker-compose logs -f"
        ;;
        
    *)
        print_error "Invalid choice. Please run the script again and choose 1, 2, or 3."
        exit 1
        ;;
esac

# Provide next steps
echo -e "\n📋 Next Steps:"
case $SETUP_LEVEL in
    1)
        echo "  • Test CLI integration: node test-direct-cli-rag.js"
        echo "  • Run unit tests: npm test"
        echo "  • Start development: npm run dev:local"
        ;;
    2)
        echo "  • Test database connections: npm run test:db"
        echo "  • Run integration tests: npm test -- tests/integration/"
        echo "  • Initialize database: npm run db:migrate"
        ;;
    3)
        echo "  • Check service status: docker-compose ps"
        echo "  • View logs: docker-compose logs -f"
        echo "  • Access API: http://localhost:3000"
        echo "  • Access ChromaDB: http://localhost:8000"
        ;;
esac

echo -e "\n🔗 Useful Commands:"
echo "  • Stop services: docker-compose down"
echo "  • View logs: docker-compose logs [service-name]"
echo "  • Reset data: docker-compose down -v && docker-compose up -d"
echo "  • Check health: curl http://localhost:8000/api/v1/heartbeat"

echo -e "\n📚 Documentation:"
echo "  • Database setup: docs/DATABASE_SETUP_DEV.md"
echo "  • Development guide: CLAUDE.md"
echo "  • Implementation status: IMPLEMENTATION.md"

print_status "Development environment setup complete! 🎉"