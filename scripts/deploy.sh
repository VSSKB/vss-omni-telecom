#!/bin/bash
set -euo pipefail

# VSS Universal Deployment Script
# Version: 2.1.0

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly LOCK_FILE="/tmp/vss-deploy.lock"

# Configuration
readonly DEPLOY_ENV="${1:-staging}"
readonly BACKUP_DIR="/opt/vss/backups"
readonly LOGDIR="/var/log/vss"
readonly CONFIG_DIR="/etc/vss"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Logging setup
setup_logging() {
    mkdir -p "${LOGDIR}"
    exec > >(tee -a "${LOGDIR}/deploy_${TIMESTAMP}.log")
    exec 2>&1
}

# Lock management
acquire_lock() {
    if [ -e "${LOCK_FILE}" ]; then
        local pid=$(cat "${LOCK_FILE}")
        if kill -0 "${pid}" 2>/dev/null; then
            log_error "Deployment already in progress (PID: ${pid})"
            exit 1
        else
            log_warning "Removing stale lock file"
            rm -f "${LOCK_FILE}"
        fi
    fi
    echo $$ > "${LOCK_FILE}"
}

release_lock() {
    rm -f "${LOCK_FILE}"
}

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"; }

# Error handling
trap 'handle_error $LINENO' ERR
trap 'cleanup' EXIT INT TERM

handle_error() {
    local line=$1
    log_error "Deployment failed at line ${line}"
    release_lock
    exit 1
}

cleanup() {
    release_lock
    log_info "Cleanup completed"
}

# Validation functions
validate_environment() {
    log_info "Validating deployment environment: ${DEPLOY_ENV}"
    
    # Check required commands
    local required_commands=("docker" "git" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "${cmd}" &> /dev/null; then
            log_error "Required command not found: ${cmd}"
            exit 1
        fi
    done
    
    # Check Docker
    if ! docker info &> /dev/null; then
        log_error "Cannot connect to Docker daemon"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

validate_configuration() {
    log_info "Validating configuration files"
    
    local config_files=(
        "${SCRIPT_DIR}/../config/nginx/nginx.conf"
        "${SCRIPT_DIR}/../config/rabbitmq/rabbitmq.conf"
        "${SCRIPT_DIR}/../config/redis/redis.conf"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ ! -f "${config_file}" ]]; then
            log_error "Configuration file missing: ${config_file}"
            exit 1
        fi
    done
    
    log_success "Configuration validation passed"
}

# Backup functions
create_backup() {
    log_info "Creating system backup"
    
    local backup_file="${BACKUP_DIR}/backup_${DEPLOY_ENV}_${TIMESTAMP}.tar.gz"
    mkdir -p "${BACKUP_DIR}"
    
    # Backup databases
    if docker exec vss_postgres pg_dumpall -U vss | gzip > "${BACKUP_DIR}/postgres_${TIMESTAMP}.sql.gz" 2>/dev/null; then
        log_success "PostgreSQL backup created"
    else
        log_warning "Failed to backup PostgreSQL"
    fi
    
    # Backup configurations
    tar -czf "${backup_file}" \
        "${SCRIPT_DIR}/../config" \
        "${SCRIPT_DIR}/../.env.production" \
        2>/dev/null || log_warning "Some files could not be backed up"
    
    # Keep only last 10 backups
    find "${BACKUP_DIR}" -name "backup_*.tar.gz" -type f | sort -r | tail -n +11 | xargs rm -f
    
    log_success "Backup created: ${backup_file}"
}

# Deployment functions
deploy_infrastructure() {
    log_info "Deploying infrastructure components"
    
    cd "${SCRIPT_DIR}/.."
    
    # Pull latest images
    log_info "Pulling latest Docker images"
    docker-compose -f docker-compose.production.yml pull
    
    # Start services
    log_info "Starting services"
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready"
    sleep 10
    
    # Check service health
    local services=("vss_postgres" "vss_rabbitmq" "vss_redis" "vss_api")
    for service in "${services[@]}"; do
        if docker ps | grep -q "${service}"; then
            log_success "Service ${service} is running"
        else
            log_error "Service ${service} failed to start"
            exit 1
        fi
    done
    
    log_success "Infrastructure deployment completed"
}

run_migrations() {
    log_info "Running database migrations"
    
    # Wait for PostgreSQL to be ready
    local retries=30
    while [ $retries -gt 0 ]; do
        if docker exec vss_postgres pg_isready -U vss &> /dev/null; then
            break
        fi
        retries=$((retries - 1))
        sleep 2
    done
    
    if [ $retries -eq 0 ]; then
        log_error "PostgreSQL is not ready"
        exit 1
    fi
    
    # Execute migrations
    for migration_file in "${SCRIPT_DIR}/../database/migrations"/*.sql; do
        if [ -f "${migration_file}" ]; then
            log_info "Running migration: $(basename ${migration_file})"
            docker exec -i vss_postgres psql -U vss -d vss_db < "${migration_file}" || {
                log_error "Migration failed: ${migration_file}"
                exit 1
            }
        fi
    done
    
    log_success "Database migrations completed"
}

# Health checks
perform_health_checks() {
    log_info "Performing post-deployment health checks"
    
    local retries=30
    local delay=10
    
    for i in $(seq 1 ${retries}); do
        log_info "Health check attempt ${i}/${retries}"
        
        if curl -s -f "http://localhost/health" > /dev/null 2>&1; then
            log_success "Application health check passed"
            break
        fi
        
        if [[ ${i} -eq ${retries} ]]; then
            log_error "Health check failed after ${retries} attempts"
            return 1
        fi
        
        sleep ${delay}
    done
    
    log_success "All health checks passed"
}

# Main deployment workflow
main() {
    log_info "Starting VSS deployment to ${DEPLOY_ENV}"
    log_info "Deployment ID: ${TIMESTAMP}"
    
    acquire_lock
    setup_logging
    
    log_info "Deployment phase 1: Validation"
    validate_environment
    validate_configuration
    
    log_info "Deployment phase 2: Backup"
    create_backup
    
    log_info "Deployment phase 3: Infrastructure"
    deploy_infrastructure
    
    log_info "Deployment phase 4: Data migration"
    run_migrations
    
    log_info "Deployment phase 5: Verification"
    perform_health_checks
    
    log_success "VSS deployment completed successfully"
    log_info "Deployment finished at: $(date)"
}

# Execute main function
main "$@"

