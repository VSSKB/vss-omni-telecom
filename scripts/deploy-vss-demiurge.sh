#!/bin/bash
# deploy-vss-demiurge.sh - Скрипт развертывания VSS DEMIURGE

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.vss-demiurge.yml"
RABBITMQ_CONFIG_DIR="./config/rabbitmq"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_environment() {
    log "Checking environment..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check configuration files
    if [ ! -f "$RABBITMQ_CONFIG_DIR/definitions.json" ]; then
        log_error "RabbitMQ definitions.json not found"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        log_warning ".env file not found, creating from template"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log "Please edit .env file with your configuration"
            exit 1
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi
}

backup_existing() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
    fi
    
    log "Creating backup of existing deployment..."
    tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" \
        ./data \
        ./config \
        ./.env 2>/dev/null || log_warning "Some files could not be backed up"
}

deploy_infrastructure() {
    log "Deploying VSS DEMIURGE infrastructure..."
    
    # Determine compose command
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    # Pull latest images
    $COMPOSE_CMD -f "$COMPOSE_FILE" pull
    
    # Start core infrastructure first
    log "Starting core infrastructure..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d rabbitmq postgresql redis
    
    # Wait for RabbitMQ to be ready
    log "Waiting for RabbitMQ to be ready..."
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T rabbitmq rabbitmq-diagnostics ping &> /dev/null; then
            log "✅ RabbitMQ is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "RabbitMQ failed to start"
        exit 1
    fi
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgresql pg_isready -U vss &> /dev/null; then
            log "✅ PostgreSQL is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "PostgreSQL failed to start"
        exit 1
    fi
    
    # Start core services
    log "Starting core services..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d vss-ottb vss-dci vss-point
    
    # Start Guacamole services
    log "Starting Guacamole services..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d guacd vss-guacamole
    
    # Start workspace
    log "Starting workspace..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d vss-workspace
    
    # Start monitoring
    log "Starting monitoring stack..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d prometheus grafana
    
    log "Infrastructure deployment completed"
}

health_check() {
    log "Performing health checks..."
    
    local services=(
        "rabbitmq:15672"
        "postgresql:5432"
        "redis:6379"
        "vss-ottb:8083"
        "vss-dci:8082"
        "vss-point:8081"
        "vss-workspace:3000"
        "vss-guacamole:8080"
        "prometheus:9090"
        "grafana:3000"
    )
    
    for service in "${services[@]}"; do
        local name=${service%:*}
        local port=${service#*:}
        
        if curl -s "http://localhost:$port" > /dev/null 2>&1 || \
           curl -s "http://localhost:$port/health" > /dev/null 2>&1 || \
           curl -s "http://localhost:$port/metrics" > /dev/null 2>&1; then
            log "✅ $name is responding"
        else
            log_warning "⚠️ $name health check failed (may need more time to start)"
        fi
    done
}

main() {
    log "Starting VSS DEMIURGE deployment..."
    
    check_environment
    backup_existing
    deploy_infrastructure
    
    log "Waiting for services to initialize..."
    sleep 10
    
    health_check
    
    log "🎉 VSS DEMIURGE deployment completed successfully!"
    log ""
    log "📊 Access URLs:"
    log "   - RabbitMQ Management: http://localhost:15672"
    log "   - VSS Workspace: http://localhost:3000"
    log "   - VSS OTTB API: http://localhost:8083"
    log "   - VSS DCI API: http://localhost:8082"
    log "   - VSS POINT API: http://localhost:8081"
    log "   - Guacamole: http://localhost:8080"
    log "   - Prometheus: http://localhost:9090"
    log "   - Grafana: http://localhost:3001 (admin / password from .env)"
    log ""
    log "🔧 Next steps:"
    log "   1. Configure your trunks in the OTTB interface"
    log "   2. Set up Tailscale for remote access"
    log "   3. Configure Archonts templates for call centers"
    log "   4. Import Grafana dashboards from config/grafana/dashboards"
}

# Error handling
trap 'log_error "Deployment failed at line $LINENO"; exit 1' ERR

main "$@"

