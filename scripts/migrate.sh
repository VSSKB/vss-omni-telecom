#!/bin/bash
set -euo pipefail

# VSS Database Migration Script
# Version: 2.1.0

readonly MIGRATION_NAME="v2.1.0_role_system_upgrade"
readonly BACKUP_DIR="/opt/vss/backups/migrations"
readonly LOG_FILE="/var/log/vss/migration_${MIGRATION_NAME}.log"
readonly LOCK_FILE="/tmp/vss-migration-${MIGRATION_NAME}.lock"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARN][$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR][$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
    exit 1
}

check_prerequisites() {
    log "Checking migration prerequisites..."
    
    # Check if migration already running
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log_error "Migration already running (PID: $pid)"
        else
            log_warning "Removing stale lock file"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    # Create lock file
    echo $$ > "$LOCK_FILE"
    
    # Check database connectivity
    if ! docker exec vss_postgres psql -U vss -d vss_db -c "SELECT 1" >/dev/null 2>&1; then
        log_error "Cannot connect to database"
    fi
    
    log "Prerequisites check passed"
}

create_backup() {
    log "Creating database backup..."
    
    local backup_file="${BACKUP_DIR}/pre_migration_${MIGRATION_NAME}_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p "$BACKUP_DIR"
    
    if ! docker exec vss_postgres pg_dump -U vss -d vss_db --format=custom > "$backup_file" 2>/dev/null; then
        log_error "Failed to create database backup"
    fi
    
    log "Backup created: $backup_file"
}

pre_migration_checks() {
    log "Running pre-migration checks..."
    
    # Check for active sessions
    local active_sessions=$(docker exec vss_postgres psql -U vss -d vss_db -t -c "SELECT COUNT(*) FROM guacamole_sessions_audit WHERE end_time IS NULL;" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$active_sessions" -gt 100 ]; then
        log_warning "High number of active sessions: $active_sessions"
    fi
    
    log "Pre-migration checks completed"
}

run_migration() {
    log "Starting migration: $MIGRATION_NAME"
    
    local migration_file="$(dirname "$0")/../database/migrations/001_v2_role_system.sql"
    
    if [ ! -f "$migration_file" ]; then
        log_error "Migration file not found: $migration_file"
    fi
    
    # Execute migration script
    if ! docker exec -i vss_postgres psql -U vss -d vss_db < "$migration_file"; then
        log_error "Migration script failed"
    fi
    
    log "Migration completed successfully"
}

post_migration_checks() {
    log "Running post-migration validation..."
    
    # Verify new tables exist
    local tables=("v2_roles" "v2_user_sessions")
    for table in "${tables[@]}"; do
        if ! docker exec vss_postgres psql -U vss -d vss_db -c "\dt $table" >/dev/null 2>&1; then
            log_error "Table $table was not created"
        fi
    done
    
    log "Post-migration validation passed"
}

cleanup() {
    rm -f "$LOCK_FILE"
    log "Migration cleanup completed"
}

main() {
    log "Starting VSS database migration: $MIGRATION_NAME"
    
    trap cleanup EXIT
    
    check_prerequisites
    create_backup
    pre_migration_checks
    run_migration
    post_migration_checks
    
    log "Migration process completed successfully"
}

main "$@"

